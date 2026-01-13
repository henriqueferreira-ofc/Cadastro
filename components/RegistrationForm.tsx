
import React, { useState } from 'react';
import { BaseAutorizada } from '../types';
import { formatCEP, formatPhone } from '../utils';
import { DBService } from '../db_service';
import { ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';

interface RegistrationFormProps {
  user: BaseAutorizada;
  onSuccess: () => void;
  onCancel: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ user, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    email: '',
    telefone: '',
    endereco: '',
    cep: ''
  });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cep') formattedValue = formatCEP(value);
    if (name === 'telefone') formattedValue = formatPhone(value);

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!consent) {
      setError('É obrigatório aceitar o termo de consentimento para prosseguir.');
      return;
    }

    // Basic Validation
    if (formData.email.indexOf('@') === -1) {
      setError('Informe um e-mail válido.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const result = DBService.saveRegistration({
        ...user,
        ...formData,
        telefone: formData.telefone.replace(/\D/g, ''),
        cep: formData.cep.replace(/\D/g, '')
      });

      setLoading(false);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Erro ao salvar cadastro.');
      }
    }, 1000);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-blue-50 border-b border-blue-100 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="text-blue-600 w-5 h-5" />
          <h2 className="font-bold text-blue-900 uppercase tracking-wider text-sm">Formulário de Atualização</h2>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">PASSO 2/2</span>
      </div>

      <form onSubmit={handleSubmit} className="p-8">
        {/* Section: Official Data (Locked) */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <ShieldAlert className="text-gray-400 w-4 h-4" />
            <h3 className="text-xs font-bold text-gray-500 uppercase">Informações da Base Oficial (Bloqueadas)</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome Completo</label>
              <div className="text-gray-700 font-semibold">{user.nome}</div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">CPF</label>
              <div className="text-gray-700 font-semibold">{user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Estado (UF)</label>
              <div className="text-gray-700 font-semibold">{user.estado}</div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Turma - CESD</label>
              <div className="text-gray-700 font-semibold">{user.turma_cesd}</div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Documento (RG)</label>
              <div className="text-gray-700 font-semibold">{user.rg}</div>
            </div>
          </div>
        </div>

        {/* Section: Editable Data */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircle2 className="text-blue-600 w-4 h-4" />
            <h3 className="text-xs font-bold text-gray-500 uppercase">Novos Dados para Atualização</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-1">E-mail Principal *</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="telefone" className="block text-sm font-semibold text-gray-700 mb-1">Telefone / WhatsApp *</label>
              <input
                type="text"
                id="telefone"
                name="telefone"
                required
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="cep" className="block text-sm font-semibold text-gray-700 mb-1">CEP *</label>
              <input
                type="text"
                id="cep"
                name="cep"
                required
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                placeholder="00000-000"
                value={formData.cep}
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="endereco" className="block text-sm font-semibold text-gray-700 mb-1">Endereço Completo *</label>
              <textarea
                id="endereco"
                name="endereco"
                required
                rows={3}
                className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all resize-none"
                placeholder="Rua, Número, Complemento, Bairro, Cidade..."
                value={formData.endereco}
                onChange={handleInputChange}
              ></textarea>
            </div>
          </div>
        </div>

        {/* Consent Section */}
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-8">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <div className="text-xs text-gray-600 leading-relaxed">
              <strong>Termo de Consentimento:</strong> Autorizo o tratamento dos meus dados pessoais informados neste formulário com a finalidade exclusiva de atualização da base cadastral organizacional, conforme os requisitos da <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018)</strong>. Estou ciente de que esta atualização é única e irrevogável por este canal.
            </div>
          </label>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm font-medium border-l-4 border-red-500">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading}
            className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Finalizar e Enviar Cadastro</span>}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="sm:w-1/3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-4 rounded-lg transition-all"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
