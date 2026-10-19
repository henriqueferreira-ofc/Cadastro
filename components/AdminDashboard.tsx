import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clipboard, Database, Download, Search, Table, Upload } from 'lucide-react';
import { BaseAutorizada, CadastroEnviado } from '../types';
import { formatCPF, getBackendUrl, validateCPF } from '../utils';
import { adminSession } from '../admin_session';

type MemberInfo = {
  cpf: string;
  status: 'ACTIVE' | 'BLOCKED' | string;
  exists: boolean;
  inAuthorizedList?: boolean;
  warning?: string;
  unlockedAt?: string | null;
  notes?: string | null;
  accessCodeAvailable?: boolean;
  cadastroRealizado?: boolean;
  portalAtivo?: boolean;
  ativacaoPortalDisponivel?: boolean;
};

const AdminDashboard: React.FC = () => {
  const backendUrl = getBackendUrl();
  const [base, setBase] = useState<BaseAutorizada[]>([]);
  const [enviados, setEnviados] = useState<CadastroEnviado[]>([]);
  const [tab, setTab] = useState<'ENVIADOS' | 'BASE'>('ENVIADOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [pageError, setPageError] = useState('');
  const [memberCpf, setMemberCpf] = useState('');
  const [memberNotes, setMemberNotes] = useState('');
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [memberMessage, setMemberMessage] = useState('');
  const [memberError, setMemberError] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const authenticatedFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = adminSession.get();
      if (!token) throw new Error('SESSION_EXPIRED');
      const response = await fetch(`${backendUrl}${path}`, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        adminSession.clear();
        throw new Error('SESSION_EXPIRED');
      }
      return response;
    },
    [backendUrl],
  );

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setPageError('');
    try {
      const [cadastrosResponse, membersResponse] = await Promise.all([
        authenticatedFetch('/cadastro/admin/list'),
        authenticatedFetch('/auth/admin/members'),
      ]);
      if (!cadastrosResponse.ok || !membersResponse.ok) throw new Error('LOAD_FAILED');
      const [cadastros, members] = await Promise.all([
        cadastrosResponse.json(),
        membersResponse.json(),
      ]);
      setEnviados(Array.isArray(cadastros) ? cadastros : []);
      setBase(Array.isArray(members) ? members : []);
    } catch (error) {
      setPageError(
        error instanceof Error && error.message === 'SESSION_EXPIRED'
          ? 'Sua sessão expirou. Saia e entre novamente.'
          : 'Não foi possível carregar os dados do servidor.',
      );
    } finally {
      setLoadingData(false);
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cleanCpf = memberCpf.replace(/\D/g, '');
  const ensureCpf = () => {
    if (!validateCPF(cleanCpf)) {
      setMemberError('Informe um CPF válido.');
      return false;
    }
    return true;
  };

  const handleLookup = async () => {
    setMemberError('');
    setMemberMessage('');
    setIssuedCode('');
    setMemberInfo(null);
    if (!ensureCpf()) return;
    setMemberLoading(true);
    try {
      const response = await authenticatedFetch(`/auth/admin/members/${cleanCpf}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Falha ao consultar CPF.');
      setMemberInfo(data);
      setMemberNotes(data?.notes || '');
      setMemberMessage(
        data?.exists
          ? data.cadastroRealizado
            ? 'CPF liberado e com cadastro já enviado.'
            : data.status === 'ACTIVE'
            ? 'CPF liberado.'
            : 'CPF cadastrado na base e bloqueado.'
          : data?.warning || 'CPF não cadastrado na base de autorizações.',
      );
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : 'Servidor indisponível.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleMemberAction = async (
    action: 'unlock' | 'block' | 'access-code' | 'portal-access',
  ) => {
    setMemberError('');
    setMemberMessage('');
    setIssuedCode('');
    if (!ensureCpf()) return;
    setMemberLoading(true);
    try {
      const response = await authenticatedFetch(`/auth/admin/members/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cleanCpf, notes: memberNotes || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Não foi possível concluir a operação.');
      const accessCode = typeof data?.accessCode === 'string' ? data.accessCode : '';
      setIssuedCode(accessCode);
      if (data?.member) {
        setMemberInfo({
          ...data.member,
          exists: true,
          cadastroRealizado:
            Boolean(data.alreadyRegistered) || Boolean(memberInfo?.cadastroRealizado),
        });
      }
      if (action === 'portal-access' && accessCode) {
        setMemberInfo((current) =>
          current ? { ...current, ativacaoPortalDisponivel: true } : current,
        );
      }
      setMemberMessage(
        action === 'block'
          ? 'CPF bloqueado com sucesso.'
          : action === 'portal-access' && accessCode
            ? memberInfo?.portalAtivo
              ? 'Código de redefinição de senha gerado. Entregue-o diretamente ao titular.'
              : 'Código de ativação do Portal do Associado gerado. Entregue-o diretamente ao titular.'
          : accessCode
            ? 'Código gerado. Entregue-o diretamente ao associado.'
            : data?.alreadyRegistered
              ? 'Este CPF já possui cadastro enviado. O código temporário é usado somente no primeiro cadastro.'
              : 'Operação concluída.',
      );
      await loadData();
    } catch (error) {
      setMemberError(error instanceof Error ? error.message : 'Servidor indisponível.');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleImport = async () => {
    const cpfs = importText.split(/[\n,;\s]+/).filter(Boolean);
    if (cpfs.length === 0) return;
    try {
      const response = await authenticatedFetch('/auth/admin/members/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpfs }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Falha na importação.');
      setShowImport(false);
      setImportText('');
      window.alert(`${data.imported || 0} novos CPFs foram incluídos como bloqueados.`);
      await loadData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Falha na importação.');
    }
  };

  const handleExportCadastros = async () => {
    try {
      const response = await authenticatedFetch('/cadastro/admin/export');
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Relatorio_AAFAB_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Não foi possível exportar o relatório.');
    }
  };

  const handleExportBase = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          base.map(({ cpf }) => cpf),
          null,
          2,
        ),
      ],
      {
        type: 'application/json',
      },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'base_autorizada.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredEnviados = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return enviados.filter(
      (item) =>
        item.nome.toLowerCase().includes(term) ||
        item.cpf.includes(searchTerm.replace(/\D/g, '')) ||
        item.email.toLowerCase().includes(term),
    );
  }, [enviados, searchTerm]);
  const filteredBase = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return base.filter(
      (item) =>
        item.nome.toLowerCase().includes(term) || item.cpf.includes(searchTerm.replace(/\D/g, '')),
    );
  }, [base, searchTerm]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-extrabold text-gray-800 mt-2">Cadastro</h2>
          <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded px-2 py-1 mt-1 inline-block">
            PAINEL ADMINISTRATIVO V1.5 · BANCO CONECTADO
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-3 bg-green-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
          >
            <Upload className="w-4 h-4" /> Importar CPFs
          </button>
          <button
            onClick={handleExportBase}
            className="px-4 py-3 bg-amber-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Exportar Base
          </button>
          <button
            onClick={handleExportCadastros}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
        </div>
      </div>

      {pageError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
          {pageError}
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Controle de acesso
            </div>
            <div className="text-sm text-gray-700 font-semibold">
              Consultar, liberar ou bloquear CPF
            </div>
          </div>
          {memberInfo && (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded ${memberInfo.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {memberInfo.status === 'ACTIVE' ? 'LIBERADO' : 'BLOQUEADO'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div>
            <label className="text-xs font-bold text-gray-500">CPF</label>
            <input
              value={memberCpf}
              onChange={(e) => setMemberCpf(formatCPF(e.target.value))}
              placeholder="000.000.000-00"
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-gray-500">OBSERVAÇÕES (OPCIONAL)</label>
            <input
              value={memberNotes}
              onChange={(e) => setMemberNotes(e.target.value.slice(0, 2000))}
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
        {memberError && <p className="mt-3 text-sm font-semibold text-red-600">{memberError}</p>}
        {memberMessage && (
          <p className="mt-3 text-sm font-semibold text-gray-700">{memberMessage}</p>
        )}
        {memberInfo?.cadastroRealizado && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Cadastro já enviado. O código de cadastro não se aplica mais. Para o primeiro acesso do
            titular, use “Gerar acesso ao portal”; atendimentos e correções ficam na aba Secretaria.
          </div>
        )}
        {issuedCode && (
          <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-bold uppercase text-green-800">
              Código temporário — copie agora
            </p>
            <div className="mt-2 flex items-center gap-3">
              <code className="text-2xl font-black tracking-[0.3em] text-green-900">
                {issuedCode}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(issuedCode)}
                title="Copiar código"
                className="p-2 bg-white border rounded-lg"
              >
                <Clipboard className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-green-800 mt-2">Válido por 24 horas e por um único uso.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={handleLookup}
            disabled={memberLoading}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Consultar
          </button>
          {memberInfo?.cadastroRealizado ? (
            <button
              onClick={() => handleMemberAction('portal-access')}
              disabled={memberLoading}
              title={
                memberInfo.portalAtivo
                  ? 'Gerar código temporário para o titular redefinir a senha'
                  : 'Gerar código para o titular criar a senha do portal'
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {memberInfo.portalAtivo
                ? 'Redefinir senha do portal'
                : memberInfo.ativacaoPortalDisponivel
                  ? 'Gerar novo código do portal'
                  : 'Gerar acesso ao portal'}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleMemberAction('unlock')}
                disabled={memberLoading}
                title="Liberar CPF e gerar o primeiro código"
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Liberar e gerar código
              </button>
              <button
                onClick={() => handleMemberAction('access-code')}
                disabled={memberLoading}
                title="Substituir um código ainda não utilizado"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Novo código
              </button>
            </>
          )}
          <button
            onClick={() => handleMemberAction('block')}
            disabled={memberLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            Bloquear CPF
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          <button
            onClick={() => setTab('ENVIADOS')}
            className={`min-w-max px-5 py-4 flex items-center gap-2 text-sm font-bold border-b-2 ${tab === 'ENVIADOS' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400'}`}
          >
            <Database className="w-4 h-4" /> Cadastros enviados ({enviados.length})
          </button>
          <button
            onClick={() => setTab('BASE')}
            className={`min-w-max px-5 py-4 flex items-center gap-2 text-sm font-bold border-b-2 ${tab === 'BASE' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400'}`}
          >
            <Table className="w-4 h-4" /> Base autorizada ({base.length})
          </button>
        </div>
        <div className="p-4 bg-gray-50 border-b flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => void loadData()}
            className="px-3 py-2 border rounded-lg text-xs font-bold bg-white"
          >
            Atualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-500">
              {tab === 'ENVIADOS' ? (
                <tr>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Data</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3">Situação</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y">
              {loadingData ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-gray-400">
                    Carregando...
                  </td>
                </tr>
              ) : tab === 'ENVIADOS' ? (
                filteredEnviados.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono">{item.cpf}</td>
                    <td className="px-4 py-3 font-semibold">{item.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{item.email}</td>
                    <td className="px-4 py-3 text-gray-500">{item.telefone}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(item.data_envio).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))
              ) : (
                filteredBase.map((item) => (
                  <tr key={item.cpf}>
                    <td className="px-4 py-3 font-mono">{item.cpf}</td>
                    <td className="px-4 py-3 font-semibold">{item.nome}</td>
                    <td className="px-4 py-3 text-gray-500">{item.estado}</td>
                    <td className="px-4 py-3 text-gray-500">{item.turma_cesd}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold ${item.cadastro_realizado ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {item.cadastro_realizado ? 'CADASTRADO' : 'AGUARDANDO'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showImport && (
        <div className="fixed inset-0 z-[70] bg-black/50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-xl shadow-2xl">
            <h3 className="text-xl font-bold">Importar CPFs</h3>
            <p className="text-sm text-gray-500 mt-1">
              Os novos CPFs entram bloqueados e precisam ser liberados individualmente para receber
              um código.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full h-64 border rounded-lg p-3 mt-4 font-mono text-sm"
              placeholder="Cole os CPFs aqui..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 border rounded-lg">
                Cancelar
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg"
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
