import React, { useState, useEffect } from 'react';
import { DBService } from '../db_service';
import { BaseAutorizada, CadastroEnviado } from '../types';
import { ChevronLeft, Download, Trash2, Database, Table, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getBackendUrl, formatCPF, validateCPF } from '../utils';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [base, setBase] = useState<BaseAutorizada[]>([]);
  const [enviados, setEnviados] = useState<CadastroEnviado[]>([]);
  const [tab, setTab] = useState<'ENVIADOS' | 'BASE'>('ENVIADOS');
  const [usingDatabase, setUsingDatabase] = useState(false);

  const [memberCpf, setMemberCpf] = useState('');
  const [memberNotes, setMemberNotes] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberMessage, setMemberMessage] = useState<string>('');
  const [memberMessageTone, setMemberMessageTone] = useState<'info' | 'success' | 'warning'>(
    'info',
  );
  const [memberInfo, setMemberInfo] = useState<null | {
    cpf: string;
    status: 'ACTIVE' | 'BLOCKED' | string;
    exists: boolean;
    inAuthorizedList?: boolean;
    warning?: string;
    unlockedAt?: string | null;
    unlockedBy?: string | null;
    notes?: string | null;
    updatedAt?: string | null;
  }>(null);

  const [showBulkUnlockModal, setShowBulkUnlockModal] = useState(false);
  const [bulkUnlockText, setBulkUnlockText] = useState('');
  const [bulkUnlockResult, setBulkUnlockResult] = useState<null | {
    totalParsed: number;
    uniqueValid: number;
    unlocked: number;
    unlockedCpfs: string[];
    alreadyActive: number;
    alreadyActiveCpfs: string[];
    invalid: number;
    invalidTokens: string[];
    failed: number;
    failures: Array<{ cpf: string; error: string }>;
  }>(null);

  const copyText = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // ignore
    }
    // Fallback simples
    window.prompt('Copie o texto abaixo:', text);
  };

  const backendUrl = getBackendUrl();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Garante que a base oficial (CSV/JSON) esteja carregada antes de renderizar a tabela.
        await DBService.loadAuthorizedCPFs();
        const baseData = DBService.getBase();
        setBase(baseData);

        const token = localStorage.getItem('admin_token');

        if (!token) {
          console.error('Token não encontrado');
          return;
        }

        // URL do backend baseado no ambiente

        // Tentar buscar do backend (desenvolvimento ou produção)
        try {
          const response = await fetch(`${backendUrl}/cadastro/admin/list`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            setEnviados(data);
            setUsingDatabase(true);
            // Sincronizar resposta para localStorage
            localStorage.setItem('cadastros_enviados', JSON.stringify(data));
            console.log('✅ Dados carregados do banco de dados');
            return;
          } else {
            console.warn('Resposta do backend não OK:', response.status);
            if (response.status === 401) {
              console.warn('🔒 Token inválido/expirado. Limpando token e exigindo novo login.');
              localStorage.removeItem('admin_token');
            }
          }
        } catch (backendError) {
          console.warn('⚠️ Backend não disponível. Usando localStorage...', backendError);
        }

        // Fallback: usar localStorage se backend falhar
        const localData = DBService.getEnviados();
        setEnviados(localData);
        setUsingDatabase(false);
        console.log('📦 Usando dados do localStorage como fallback');
      } catch (error) {
        console.error('Erro ao carregar dados do admin:', error);
        const localData = DBService.getEnviados();
        setEnviados(localData);
      }
    };
    loadData();
  }, []);

  const normalizeCpf = (value: string) => value.replace(/\D/g, '');

  const formatUnlockedAt = (unlockedAt?: string | null) => {
    if (!unlockedAt) return '';
    const date = new Date(unlockedAt);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('pt-BR');
  };

  const requireAdminToken = (): string | null => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setMemberError('Sessão expirada. Faça login novamente.');
      return null;
    }
    return token;
  };

  const handleMemberLookup = async () => {
    setMemberError('');
    setMemberMessage('');
    setMemberInfo(null);

    const cleanCpf = normalizeCpf(memberCpf);
    if (!validateCPF(cleanCpf)) {
      setMemberError('Informe um CPF válido.');
      return;
    }

    const token = requireAdminToken();
    if (!token) return;

    setMemberLoading(true);
    try {
      const res = await fetch(`${backendUrl}/auth/admin/members/${cleanCpf}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}) as any);
        if (res.status === 401) {
          localStorage.removeItem('admin_token');
        }
        setMemberError(errorData?.error || 'Falha ao consultar CPF.');
        return;
      }

      const data = await res.json();
      setMemberInfo(data);
      setMemberNotes(typeof data?.notes === 'string' ? data.notes : '');

      if (data?.inAuthorizedList === false) {
        setMemberMessageTone('warning');
          setMemberMessage(
            data?.warning || 'ALERTA: CPF não faz parte do sistema (não está na lista AAFAB).',
          );
        return;
      }

      if (data?.status === 'ACTIVE') {
        setMemberMessageTone('info');
        const when = formatUnlockedAt(data?.unlockedAt);
        setMemberMessage(when ? `CPF já está liberado desde: ${when}.` : 'CPF já está liberado.');
      }
    } catch (e) {
      setMemberError('Servidor indisponível.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleMemberAction = async (action: 'unlock' | 'block') => {
    setMemberError('');
    setMemberMessage('');

    const cleanCpf = normalizeCpf(memberCpf);
    if (!validateCPF(cleanCpf)) {
      setMemberError('Informe um CPF válido.');
      return;
    }

    const token = requireAdminToken();
    if (!token) return;

    if (
      memberInfo &&
      normalizeCpf(memberInfo.cpf) === cleanCpf &&
      memberInfo.inAuthorizedList === false
    ) {
      setMemberMessageTone('warning');
      setMemberMessage(memberInfo.warning || 'ALERTA: CPF não faz parte do sistema.');
      return;
    }

    if (
      action === 'unlock' &&
      memberInfo &&
      normalizeCpf(memberInfo.cpf) === cleanCpf &&
      memberInfo.status === 'ACTIVE'
    ) {
      setMemberMessageTone('info');
      const when = formatUnlockedAt(memberInfo.unlockedAt);
      setMemberMessage(when ? `CPF já está liberado desde: ${when}.` : 'CPF já está liberado.');
      return;
    }

    setMemberLoading(true);
    try {
      const res = await fetch(`${backendUrl}/auth/admin/members/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ cpf: cleanCpf, notes: memberNotes || undefined }),
      });

      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('admin_token');
        }
        // Mensagem diferenciada para CPF fora do sistema
        if (data?.code === 'CPF_NOT_IN_SYSTEM') {
          setMemberMessageTone('warning');
          setMemberMessage(data?.error || 'ALERTA: CPF não faz parte do sistema.');
          return;
        }

        setMemberError(data?.error || 'Falha ao atualizar status.');
        return;
      }

      // Recarrega status após ação
      await handleMemberLookup();

      if (action === 'unlock') {
        const when = formatUnlockedAt(data?.member?.unlockedAt);
        if (data?.alreadyActive) {
          setMemberMessageTone('info');
          setMemberMessage(when ? `CPF já está liberado desde: ${when}.` : 'CPF já está liberado.');
        } else {
          setMemberMessageTone('success');
          setMemberMessage(
            when ? `CPF liberado com sucesso em: ${when}.` : 'CPF liberado com sucesso.',
          );
        }
      }
    } catch (e) {
      setMemberError('Servidor indisponível.');
    } finally {
      setMemberLoading(false);
    }
  };

  const parseCpfList = (
    text: string,
  ): { cpfs: string[]; invalidCount: number; invalidTokens: string[]; totalTokens: number } => {
    // Aceita CPFs separados por quebra de linha, vírgula, ponto e vírgula ou espaço
    const tokens = text
      .replace(/\r/g, '\n')
      .split(/[\n,;\t ]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    let invalidCount = 0;
    const invalidTokens: string[] = [];
    const seen = new Set<string>();
    const cpfs: string[] = [];

    for (const token of tokens) {
      const clean = normalizeCpf(token);
      if (!validateCPF(clean)) {
        invalidCount += 1;
        if (invalidTokens.length < 50) invalidTokens.push(token);
        continue;
      }
      if (seen.has(clean)) continue;
      seen.add(clean);
      cpfs.push(clean);
    }

    return { cpfs, invalidCount, invalidTokens, totalTokens: tokens.length };
  };

  const handleBulkUnlock = async () => {
    setMemberError('');
    setMemberMessage('');
    setBulkUnlockResult(null);

    const token = requireAdminToken();
    if (!token) return;

    const parsed = parseCpfList(bulkUnlockText);
    if (parsed.cpfs.length === 0) {
      setMemberError('Cole pelo menos 1 CPF válido para liberar.');
      return;
    }

    setMemberLoading(true);
    try {
      let unlocked = 0;
      const unlockedCpfs: string[] = [];
      let alreadyActive = 0;
      const alreadyActiveCpfs: string[] = [];
      let failed = 0;
      const failures: Array<{ cpf: string; error: string }> = [];

      for (const cpf of parsed.cpfs) {
        // 1) Consulta status (evita duplicação)
        const lookupRes = await fetch(`${backendUrl}/auth/admin/members/${cpf}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const lookupData = await lookupRes.json().catch(() => ({}) as any);
        if (!lookupRes.ok) {
          failed += 1;
          failures.push({ cpf, error: lookupData?.error || 'Falha ao consultar.' });
          continue;
        }

        if (lookupData?.inAuthorizedList === false) {
          failed += 1;
          failures.push({
            cpf,
             error: lookupData?.warning || 'CPF não faz parte do sistema (não está na lista AAFAB).',
          });
          continue;
        }

        if (lookupData?.status === 'ACTIVE') {
          alreadyActive += 1;
          alreadyActiveCpfs.push(cpf);
          continue;
        }

        // 2) Libera
        const unlockRes = await fetch(`${backendUrl}/auth/admin/members/unlock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cpf, notes: memberNotes || undefined }),
        });

        const unlockData = await unlockRes.json().catch(() => ({}) as any);
        if (!unlockRes.ok) {
          failed += 1;
          failures.push({ cpf, error: unlockData?.error || 'Falha ao liberar.' });
          continue;
        }
        unlocked += 1;
        unlockedCpfs.push(cpf);
      }

      setBulkUnlockResult({
        totalParsed: parsed.totalTokens,
        uniqueValid: parsed.cpfs.length,
        unlocked,
        unlockedCpfs,
        alreadyActive,
        alreadyActiveCpfs,
        invalid: parsed.invalidCount,
        invalidTokens: parsed.invalidTokens,
        failed,
        failures,
      });

      setMemberMessageTone('success');
      setMemberMessage(
        `Lote processado: ${unlocked} liberados, ${alreadyActive} já estavam liberados, ${failed} falharam.`,
      );
    } catch (e) {
      setMemberError('Servidor indisponível.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleExport = async () => {
    const token = localStorage.getItem('admin_token');

    // If using local token, use local export with xlsx
    if (token === 'local_admin_access') {
      if (enviados.length === 0) {
        alert('Não há dados para exportar.');
        return;
      }

      const exportData = enviados.map((e) => ({
        CPF: e.cpf,
        NOME: e.nome,
        EMAIL: e.email,
        TELEFONE: e.telefone,
        ESTADO: e.estado,
        BAIRRO: e.bairro,
        CIDADE: e.cidade,
        ENDEREÇO: e.endereco,
        TURMA: e.turma_cesd,
        'CERTIDÃO DE ÓBITO': e.certidao_obito || '',
        'DATA ENVIO': new Date(e.data_envio).toLocaleString('pt-BR'),
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cadastros Enviados');
      XLSX.writeFile(
        workbook,
        `Relatorio_Cadastros_${new Date().toISOString().split('T')[0]}.xlsx`,
      );
      return;
    }

    // Backend export with JWT
    try {
      if (!token) {
        alert('Sessão expirada. Faça login novamente.');
        return;
      }

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/cadastro/admin/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Falha ao exportar.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_AAFAB_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao exportar Excel.');
    }
  };

  const handleReset = () => {
    if (
      window.confirm(
        'ATENÇÃO: Isso apagará todos os dados enviados e resetará a base. Deseja continuar?',
      )
    ) {
      DBService.resetData();
    }
  };

  const handleExportBase = () => {
    const baseData = DBService.getBase();
    const cpfs = baseData.map((u) => u.cpf);
    const blob = new Blob([JSON.stringify(cpfs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'authorized_cpfs.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const handleImport = () => {
    if (!importText.trim()) return;

    // Improved split logic: split by newlines, commas, semicolons to preserve formatting
    const rawCpfs = importText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (rawCpfs.length === 0) {
      alert('Nenhum número encontrado no texto colado.');
      return;
    }

    const confirmMessage = `Encontrados ${rawCpfs.length} itens para processar. Deseja iniciar a importação?`;
    if (!window.confirm(confirmMessage)) return;

    const result = DBService.updateAuthorizedBase(rawCpfs);

    if (result.success) {
      const skipped = rawCpfs.length - result.count;
      alert(
        `Relatório de Importação:\n\n` +
          `✅ Adicionados com sucesso: ${result.count}\n` +
          `⚠️ Ignorados (Duplicados ou Inválidos): ${skipped}\n` +
          `   - O sistema removeu automaticamente duplicatas.\n\n` +
          `Total na base agora: ${DBService.getBase().length}`,
      );
      setBase(DBService.getBase());
      setImportText('');
      setShowImportModal(false);
    } else {
      alert(`Erro: ${result.error}`);
    }
  };

  const filteredEnviados = enviados.filter(
    (e) =>
      e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.cpf.includes(searchTerm) ||
      e.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredBase = base.filter(
    (u) => u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || u.cpf.includes(searchTerm),
  );

  const displayData = tab === 'ENVIADOS' ? filteredEnviados : filteredBase;

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-500 hover:text-gray-800 transition-colors mb-1"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Voltar ao Início</span>
          </button>
          <div
            className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${
              usingDatabase
                ? 'text-green-600 bg-green-50 border-green-100'
                : 'text-red-500 bg-red-50 border-red-100'
            }`}
          >
            Painel Administrativo v1.4 -{' '}
            {usingDatabase ? '📡 Banco Neon (Conectado)' : '📦 Base Local (Offline/Estática)'}
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 shadow-sm transition-all"
          >
            <Database className="w-4 h-4" />
            <span>Importar CPFs</span>
          </button>
          <button
            onClick={handleExportBase}
            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Base (JSON)</span>
          </button>
          <button
            onClick={handleExport}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 shadow-sm transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
          <button
            onClick={handleReset}
            className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 border border-red-200 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar Dados</span>
          </button>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Importar Lista de CPFs</h3>
            <p className="text-sm text-gray-500 mb-4">
              Cole a lista de CPFs abaixo. O sistema aceita números separados por quebra de linha,
              vírgula ou espaço. Apenas números serão processados.
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Cole os CPFs aqui...&#10;111.222.333-44&#10;55566677788&#10;..."
              className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
            />

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!importText.trim()}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Processar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Controle de Acesso (Mensalidade)
            </div>
            <div className="text-sm text-gray-700 font-semibold">
              Consultar, liberar ou bloquear CPF
            </div>
          </div>
          {memberInfo && (
            <div
              className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${
                memberInfo.status === 'ACTIVE'
                  ? 'text-green-600 bg-green-50 border-green-100'
                  : 'text-red-600 bg-red-50 border-red-100'
              }`}
            >
              {memberInfo.status === 'ACTIVE' ? 'LIBERADO' : 'BLOQUEADO'}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF</label>
            <input
              value={memberCpf}
              onChange={(e) => setMemberCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Observações (opcional)
            </label>
            <input
              value={memberNotes}
              onChange={(e) => setMemberNotes(e.target.value)}
              placeholder="Ex: Pagamento confirmado em 19/01/2026"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {memberError && (
          <div className="mt-3 text-sm text-red-600 font-semibold">{memberError}</div>
        )}

        {memberMessage && !memberError && (
          <div
            className={`mt-3 text-sm font-semibold ${
              memberMessageTone === 'success'
                ? 'text-green-700'
                : memberMessageTone === 'warning'
                  ? 'text-amber-700'
                  : 'text-gray-700'
            }`}
          >
            {memberMessage}
          </div>
        )}

        {memberInfo && (
          <div className="mt-3 text-xs text-gray-600">
            <span className="font-mono">{memberInfo.cpf}</span>
            {memberInfo.unlockedAt
              ? ` • Liberado em: ${new Date(memberInfo.unlockedAt).toLocaleString('pt-BR')}`
              : ''}
            {memberInfo.unlockedBy ? ` • Por: ${memberInfo.unlockedBy}` : ''}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleMemberLookup}
            disabled={memberLoading}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {memberLoading ? 'Aguarde...' : 'Consultar'}
          </button>
          <button
            onClick={() => handleMemberAction('unlock')}
            disabled={memberLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Liberar CPF
          </button>
          <button
            onClick={() => {
              setBulkUnlockResult(null);
              setBulkUnlockText('');
              setShowBulkUnlockModal(true);
            }}
            disabled={memberLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Liberar em lote
          </button>
          <button
            onClick={() => handleMemberAction('block')}
            disabled={memberLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Bloquear CPF
          </button>
        </div>
      </div>

      {showBulkUnlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Liberar CPFs em lote</h3>
            <p className="text-sm text-gray-500 mb-4">
              Cole a sequência de CPFs abaixo. O sistema aceita números separados por quebra de
              linha, vírgula, ponto e vírgula ou espaço. CPFs duplicados serão ignorados.
            </p>

            <textarea
              value={bulkUnlockText}
              onChange={(e) => setBulkUnlockText(e.target.value)}
              placeholder="Cole os CPFs aqui...\n111.222.333-44\n55566677788\n..."
              className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
            />

            {bulkUnlockResult && (
              <div className="mb-4 text-sm text-gray-700">
                <div>
                  <span className="font-bold">Válidos únicos:</span> {bulkUnlockResult.uniqueValid}
                </div>
                <div>
                  <span className="font-bold">Liberados agora:</span> {bulkUnlockResult.unlocked}
                </div>
                <div>
                  <span className="font-bold">Já liberados:</span> {bulkUnlockResult.alreadyActive}
                </div>
                <div>
                  <span className="font-bold">Inválidos ignorados:</span> {bulkUnlockResult.invalid}
                </div>
                <div>
                  <span className="font-bold">Falhas:</span> {bulkUnlockResult.failed}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const report = [
                        `Liberados agora (${bulkUnlockResult.unlockedCpfs.length}):`,
                        bulkUnlockResult.unlockedCpfs.join('\n'),
                        '',
                        `Já liberados (${bulkUnlockResult.alreadyActiveCpfs.length}):`,
                        bulkUnlockResult.alreadyActiveCpfs.join('\n'),
                        '',
                        `Inválidos (exemplos até 50) (${bulkUnlockResult.invalidTokens.length}):`,
                        bulkUnlockResult.invalidTokens.join('\n'),
                        '',
                        `Falhas (${bulkUnlockResult.failures.length}):`,
                        bulkUnlockResult.failures.map((f) => `${f.cpf}: ${f.error}`).join('\n'),
                      ].join('\n');
                      void copyText(report);
                    }}
                    className="px-3 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-bold"
                  >
                    Copiar relatório
                  </button>
                  <button
                    onClick={() => void copyText(bulkUnlockResult.unlockedCpfs.join('\n'))}
                    className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold"
                  >
                    Copiar liberados
                  </button>
                  <button
                    onClick={() => void copyText(bulkUnlockResult.alreadyActiveCpfs.join('\n'))}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                  >
                    Copiar já liberados
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  <details className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <summary className="cursor-pointer font-bold text-gray-800">
                      Ver CPFs liberados agora
                    </summary>
                    <textarea
                      readOnly
                      value={bulkUnlockResult.unlockedCpfs.join('\n')}
                      className="mt-2 w-full h-28 p-2 border border-gray-200 rounded font-mono text-xs"
                    />
                  </details>
                  <details className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <summary className="cursor-pointer font-bold text-gray-800">
                      Ver CPFs que já estavam liberados
                    </summary>
                    <textarea
                      readOnly
                      value={bulkUnlockResult.alreadyActiveCpfs.join('\n')}
                      className="mt-2 w-full h-28 p-2 border border-gray-200 rounded font-mono text-xs"
                    />
                  </details>
                  {bulkUnlockResult.invalidTokens.length > 0 && (
                    <details className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <summary className="cursor-pointer font-bold text-gray-800">
                        Ver inválidos (até 50)
                      </summary>
                      <textarea
                        readOnly
                        value={bulkUnlockResult.invalidTokens.join('\n')}
                        className="mt-2 w-full h-24 p-2 border border-gray-200 rounded font-mono text-xs"
                      />
                    </details>
                  )}
                </div>

                {bulkUnlockResult.failed > 0 && (
                  <div className="mt-2 text-xs text-red-700">
                    {bulkUnlockResult.failures.slice(0, 10).map((f) => (
                      <div key={f.cpf}>
                        <span className="font-mono">{f.cpf}</span>: {f.error}
                      </div>
                    ))}
                    {bulkUnlockResult.failures.length > 10 ? <div>... (mais falhas)</div> : null}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkUnlockModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
              >
                Fechar
              </button>
              <button
                onClick={handleBulkUnlock}
                disabled={memberLoading || !bulkUnlockText.trim()}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {memberLoading ? 'Processando...' : 'Liberar lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setTab('ENVIADOS')}
            className={`px-6 py-4 flex items-center space-x-2 text-sm font-bold transition-all border-b-2 ${tab === 'ENVIADOS' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <Database className="w-4 h-4" />
            <span>Tabela: Cadastros Enviados ({enviados.length})</span>
          </button>
          <button
            onClick={() => setTab('BASE')}
            className={`px-6 py-4 flex items-center space-x-2 text-sm font-bold transition-all border-b-2 ${tab === 'BASE' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            <Table className="w-4 h-4" />
            <span>Tabela: Base Autorizada ({base.length})</span>
          </button>
        </div>
        <div className="p-4 bg-gray-50 flex items-center justify-between border-b border-gray-200">
          <div className="relative flex-grow max-w-md">
            <input
              type="text"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          </div>
          <div className="ml-4 text-[10px] text-gray-400 font-mono">
            {tab === 'BASE'
              ? `${filteredBase.length} de ${base.length} CPFs autorizados`
              : `${filteredEnviados.length} envios encontrados`}
          </div>
        </div>
      </div>

      <div className="p-0 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold border-b border-gray-200">
            {tab === 'ENVIADOS' ? (
              <tr>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Data Envio</th>
              </tr>
            ) : (
              <tr>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Turma</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {tab === 'ENVIADOS' ? (
              displayData.length > 0 ? (
                (displayData as CadastroEnviado[]).map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">{e.cpf}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{e.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{e.email}</td>
                    <td className="px-4 py-3 text-gray-500">{e.telefone}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(e.data_envio).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400 italic">
                    Nenhum cadastro enviado ainda.
                  </td>
                </tr>
              )
            ) : (
              (displayData as BaseAutorizada[]).map((u) => (
                <tr key={u.cpf} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{u.cpf}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{u.estado}</td>
                  <td className="px-4 py-3 text-gray-500">{u.turma_cesd}</td>
                  <td className="px-4 py-3">
                    {u.cadastro_realizado ? (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        CADASTRO REALIZADO
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        AGUARDANDO
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminDashboard;
