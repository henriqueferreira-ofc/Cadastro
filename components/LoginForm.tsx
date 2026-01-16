
import React, { useState } from 'react';
import { formatCPF, validateCPF } from '../utils';
import { DBService } from '../db_service';
import { BaseAutorizada } from '../types';
import { Search, AlertCircle, Info } from 'lucide-react';

interface LoginFormProps {
  onSuccess: (user: BaseAutorizada) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [cpf, setCpf] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCpf = cpf.replace(/\D/g, '');

    if (!validateCPF(cleanCpf)) {
      setError('Por favor, informe um CPF válido.');
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      const result = DBService.checkCPF(cleanCpf);
      setLoading(false);

      if (result.success && result.data) {
        onSuccess(result.data);
      } else {
        setError(result.error || 'Erro inesperado.');
      }
    }, 600);
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-2xl shadow-lg sm:shadow-xl overflow-hidden animate-in fade-in duration-500">
      <div className="p-4 sm:p-8 md:p-12">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Bem-vindo ao Portal.</h2>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Exclusivo para Associado da AAFAB</h2>
          <p className="text-sm sm:text-base text-gray-500 mt-2">Informe seu CPF para iniciar a atualização cadastral</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="relative">
            <label htmlFor="cpf" className="block text-sm font-semibold text-gray-700 mb-2">
              CPF do Titular
            </label>
            <div className="relative">
              <input
                id="cpf"
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`w-full px-4 py-3 bg-gray-50 border ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'} rounded-lg focus:outline-none focus:ring-4 transition-all text-base sm:text-lg tracking-wider font-medium`}
                required
              />
              <Search className="absolute right-3 top-3.5 text-gray-400 w-5 h-5" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4 flex items-start gap-2 sm:gap-3 rounded">
              <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 sm:py-4 rounded-lg shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Acessar Formulário</span>
            )}
          </button>
        </form>

        <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-100">
          <div className="flex items-start gap-2 sm:gap-3 text-xs text-gray-500 leading-relaxed">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Ao acessar o sistema, você declara estar ciente de que seus dados serão processados conforme as políticas internas de privacidade e a LGPD (Lei Geral de Proteção de Dados).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
