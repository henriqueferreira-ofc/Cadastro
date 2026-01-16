
import React, { useState, useEffect } from 'react';
import { DBService } from '../db_service';
import { BaseAutorizada, CadastroEnviado } from '../types';
import { ChevronLeft, Download, Trash2, Database, Table, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [base, setBase] = useState<BaseAutorizada[]>([]);
  const [enviados, setEnviados] = useState<CadastroEnviado[]>([]);
  const [tab, setTab] = useState<'ENVIADOS' | 'BASE'>('ENVIADOS');
  const [usingDatabase, setUsingDatabase] = useState(false);

  // Função auxiliar para obter URL do backend
  const getBackendUrl = (): string => {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      return 'http://localhost:3001/api';
    }
    
    // Em produção, usar a URL do backend configurada
    const envUrl = (import.meta as any).env.VITE_API_URL;
    if (envUrl) {
      return envUrl;
    }
    
    // Fallback: tentar usar a mesma origem
    return `${window.location.origin}/api`;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const baseData = DBService.getBase();
        setBase(baseData);

        const token = localStorage.getItem('admin_token');

        if (!token) {
          console.error('Token não encontrado');
          return;
        }

        // Construir URL do backend baseado no ambiente
        const backendUrl = getBackendUrl();
        
        // Tentar buscar do backend (desenvolvimento ou produção)
        try {
          const response = await fetch(`${backendUrl}/cadastro/admin/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
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

  const handleExport = async () => {
    const token = localStorage.getItem('admin_token');

    // If using local token, use local export with xlsx
    if (token === 'local_admin_access') {
      if (enviados.length === 0) {
        alert("Não há dados para exportar.");
        return;
      }

      const exportData = enviados.map(e => ({
        'CPF': e.cpf,
        'Nome': e.nome,
        'Email': e.email,
        'Telefone': e.telefone,
        'Estado': e.estado,
        'Bairro': e.bairro,
        'Cidade': e.cidade,
        'Endereço': e.endereco,
        'Turma': e.turma_cesd,
        'Certidão de Óbito': e.certidao_obito || '',
        'Data Envio': new Date(e.data_envio).toLocaleString('pt-BR')
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cadastros Enviados");
      XLSX.writeFile(workbook, `Relatorio_Cadastros_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        headers: { 'Authorization': `Bearer ${token}` }
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
    if (window.confirm("ATENÇÃO: Isso apagará todos os dados enviados e resetará a base. Deseja continuar?")) {
      DBService.resetData();
    }
  };

  const handleExportBase = () => {
    const baseData = DBService.getBase();
    const cpfs = baseData.map(u => u.cpf);
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
    const rawCpfs = importText.split(/[\n,;]+/).map(s => s.trim()).filter(s => s.length > 0);

    if (rawCpfs.length === 0) {
      alert("Nenhum número encontrado no texto colado.");
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
        `Total na base agora: ${DBService.getBase().length}`
      );
      setBase(DBService.getBase());
      setImportText('');
      setShowImportModal(false);
    } else {
      alert(`Erro: ${result.error}`);
    }
  };

  const filteredEnviados = enviados.filter(e =>
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.cpf.includes(searchTerm) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBase = base.filter(u =>
    u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.cpf.includes(searchTerm)
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
          <div className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-widest ${
            usingDatabase 
              ? 'text-green-600 bg-green-50 border-green-100' 
              : 'text-red-500 bg-red-50 border-red-100'
          }`}>
            Painel Administrativo v1.4 - {usingDatabase ? '📡 Banco Neon (Conectado)' : '📦 Base Local (Offline/Estática)'}
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
            <p className="text-sm text-gray-500 mb-4">Cole a lista de CPFs abaixo. O sistema aceita números separados por quebra de linha, vírgula ou espaço. Apenas números serão processados.</p>

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
            {tab === 'BASE' ? `${filteredBase.length} de ${base.length} CPFs autorizados` : `${filteredEnviados.length} envios encontrados`}
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
              displayData.length > 0 ? (displayData as CadastroEnviado[]).map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{e.cpf}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{e.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{e.email}</td>
                  <td className="px-4 py-3 text-gray-500">{e.telefone}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(e.data_envio).toLocaleString()}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 italic">Nenhum cadastro enviado ainda.</td></tr>
              )
            ) : (
              (displayData as BaseAutorizada[]).map(u => (
                <tr key={u.cpf} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{u.cpf}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-500">{u.estado}</td>
                  <td className="px-4 py-3 text-gray-500">{u.turma_cesd}</td>
                  <td className="px-4 py-3">
                    {u.cadastro_realizado ? (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">CADASTRO REALIZADO</span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-[10px] font-bold">AGUARDANDO</span>
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
