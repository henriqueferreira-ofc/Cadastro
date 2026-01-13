
import React, { useState, useEffect } from 'react';
import { DBService } from '../db_service';
import { BaseAutorizada, CadastroEnviado } from '../types';
import { ChevronLeft, Download, Trash2, Database, Table } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [base, setBase] = useState<BaseAutorizada[]>([]);
  const [enviados, setEnviados] = useState<CadastroEnviado[]>([]);
  const [tab, setTab] = useState<'ENVIADOS' | 'BASE'>('ENVIADOS');

  useEffect(() => {
    setBase(DBService.getBase());
    setEnviados(DBService.getEnviados());
  }, []);

  const handleExport = () => {
    if (enviados.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }

    const exportData = enviados.map(e => ({
      'NOME': e.nome,
      'ESTADO': e.estado,
      'TURMA - CESD': e.turma_cesd,
      'RG': e.rg,
      'CPF': e.cpf,
      'E-MAIL': e.email,
      'TEL': e.telefone,
      'ENDEREÇO': e.endereco,
      'CEP': e.cep,
      'DATA ENVIO': new Date(e.data_envio).toLocaleString('pt-BR')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cadastros Enviados");
    XLSX.writeFile(workbook, `Relatorio_Cadastros_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleReset = () => {
    if (window.confirm("ATENÇÃO: Isso apagará todos os dados enviados e resetará a base. Deseja continuar?")) {
      DBService.resetData();
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="font-medium">Voltar ao Início</span>
        </button>
        <div className="flex space-x-3">
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
                enviados.length > 0 ? enviados.map(e => (
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
                base.map(u => (
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
    </div>
  );
};

export default AdminDashboard;
