
import React, { useState, useEffect } from 'react';
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
  const [formData, setFormData] = useState(() => {
    return {
      nome: user.nome.includes('AUTORIZADO') ? '' : user.nome,
      estado: user.estado === 'SP' ? '' : user.estado,
      turma_cesd: user.turma_cesd === '2024/2' ? '' : user.turma_cesd,
      rg: user.rg === 'N/A' ? '' : user.rg,
      email: '',
      telefone: '',
      endereco: '',
      bairro: '',
      cidade: '',
      cep: '',
      certidao_obito: user.certidao_obito || ''
    };
  });
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Buscar dados do backend se já houver cadastro
  useEffect(() => {
    const loadExistingData = async () => {
      // Primeiro tenta local
      const enviados = DBService.getEnviados();
      const existingLocal = enviados.find(e => e.cpf === user.cpf);

      if (existingLocal) {
        setFormData({
          nome: existingLocal.nome,
          estado: existingLocal.estado,
          turma_cesd: existingLocal.turma_cesd,
          rg: existingLocal.rg,
          email: existingLocal.email,
          telefone: formatPhone(existingLocal.telefone),
          endereco: existingLocal.endereco,
          bairro: existingLocal.bairro || '',
          cidade: existingLocal.cidade || '',
          cep: formatCEP(existingLocal.cep),
          certidao_obito: existingLocal.certidao_obito || ''
        });
        return;
      }

      // Se não encontrou local, busca no backend
      const backendData = await DBService.getCadastroFromBackend(user.cpf);
      if (backendData) {
        setFormData({
          nome: backendData.nome,
          estado: backendData.estado,
          turma_cesd: backendData.turma_cesd,
          rg: backendData.rg,
          email: backendData.email,
          telefone: formatPhone(backendData.telefone),
          endereco: backendData.endereco,
          bairro: backendData.bairro || '',
          cidade: backendData.cidade || '',
          cep: formatCEP(backendData.cep),
          certidao_obito: backendData.certidao_obito || ''
        });
      }
    };

    loadExistingData();
  }, [user.cpf]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'nome') formattedValue = value.toUpperCase();
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

    // Validation
    if (!formData.nome.trim()) { setError('Nome completo é obrigatório.'); return; }
    if (!formData.rg.trim()) { setError('RG é obrigatório.'); return; }
    if (!formData.turma_cesd.trim()) { setError('Turma é obrigatória.'); return; }

    if (formData.email.indexOf('@') === -1) {
      setError('Informe um e-mail válido.');
      return;
    }

    setLoading(true);

    // Backend call through DBService
    DBService.saveRegistration({
      ...user,
      ...formData,
      telefone: formData.telefone.replace(/\D/g, ''),
      cep: formData.cep.replace(/\D/g, '')
    }).then(result => {
      setLoading(false);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Erro ao salvar cadastro.');
      }
    }).catch(err => {
      setLoading(false);
      setError('Erro de conexão com o servidor.');
    });
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-gray-100 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-blue-50 border-b border-blue-100 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="text-blue-600 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
          <h2 className="font-bold text-blue-900 uppercase tracking-wider text-xs sm:text-sm">Formulário de Atualização</h2>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold flex-shrink-0">ETAPA ÚNICA</span>
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-8">
        {/* Section: Personal Data */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <CheckCircle2 className="text-blue-600 w-4 h-4 flex-shrink-0" />
            <h3 className="text-xs font-bold text-gray-500 uppercase">Dados Pessoais</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 bg-gray-50 p-4 sm:p-6 rounded-lg sm:rounded-xl border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CPF (Verificado)</label>
              <div className="bg-gray-200 px-3 py-2 rounded text-sm text-gray-600 font-mono font-bold select-none cursor-not-allowed break-all">
                {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="nome" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Nome Completo *</label>
              <input
                type="text"
                id="nome"
                name="nome"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="Digite seu nome completo"
                value={formData.nome}
                onChange={handleInputChange}
              />
            </div>

            <div>
              <label htmlFor="rg" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">RG *</label>
              <input
                type="text"
                id="rg"
                name="rg"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="Número do RG"
                value={formData.rg}
                onChange={handleInputChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label htmlFor="estado" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Estado *</label>
                <select
                  id="estado"
                  name="estado"
                  required
                  className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                  value={formData.estado}
                  onChange={handleInputChange}
                >
                  <option value="">UF</option>
                  {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="turma_cesd" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Turma *</label>
                <input
                  type="text"
                  id="turma_cesd"
                  name="turma_cesd"
                  required
                  className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="Ex: 2024/1"
                  value={formData.turma_cesd}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="certidao_obito" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Número de Certidão de Óbito (caso haja)</label>
              <input
                type="text"
                id="certidao_obito"
                name="certidao_obito"
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="Digite o número da certidão (se aplicável)"
                value={formData.certidao_obito}
                onChange={handleInputChange}
              />
            </div>
          </div>
        </div>

        {/* Section: Editable Data */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <CheckCircle2 className="text-blue-600 w-4 h-4 flex-shrink-0" />
            <h3 className="text-xs font-bold text-gray-500 uppercase">Novos Dados para Atualização</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="md:col-span-2">
              <label htmlFor="email" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">E-mail Principal *</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="telefone" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Telefone / WhatsApp *</label>
              <input
                type="text"
                id="telefone"
                name="telefone"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="(00) 00000-0000"
                value={formData.telefone}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="cep" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">CEP *</label>
              <input
                type="text"
                id="cep"
                name="cep"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="00000-000"
                value={formData.cep}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="bairro" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Bairro *</label>
              <input
                type="text"
                id="bairro"
                name="bairro"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="Seu Bairro"
                value={formData.bairro}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label htmlFor="cidade" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Cidade *</label>
              <input
                type="text"
                id="cidade"
                name="cidade"
                required
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm"
                placeholder="Sua Cidade"
                value={formData.cidade}
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="endereco" className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2">Endereço Completo *</label>
              <textarea
                id="endereco"
                name="endereco"
                required
                rows={3}
                className="w-full px-3 sm:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all resize-none text-sm"
                placeholder="Rua, Número e Complemento"
                value={formData.endereco}
                onChange={handleInputChange}
              ></textarea>
            </div>
          </div>
        </div>

        {/* Consent Section */}
        <div className="bg-gray-50 border border-gray-200 p-3 sm:p-4 rounded-lg mb-6 sm:mb-8">
          <label className="flex items-start gap-2 sm:gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 flex-shrink-0"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <div className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              <strong>Termo de Consentimento:</strong> Autorizo o tratamento dos meus dados pessoais informados neste formulário com a finalidade exclusiva de atualização da base cadastral organizacional, conforme os requisitos da <strong>Lei Geral de Proteção de Dados (Lei 13.709/2018)</strong>. Estou ciente de que esta atualização é única e irrevogável por este canal.
            </div>
          </label>
        </div>

        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 text-red-700 rounded-lg text-xs sm:text-sm font-medium border-l-4 border-red-500">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-gray-100">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 sm:py-4 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span>Finalizar e Enviar Cadastro</span>}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 sm:py-4 rounded-lg transition-all text-sm sm:text-base"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default RegistrationForm;
