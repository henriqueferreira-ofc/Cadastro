
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
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-500">
      <div className="p-8 sm:p-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Portal de Atualização v1.2</h2>
          <p className="text-gray-500 mt-2">Informe seu CPF para iniciar a atualização cadastral</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <label htmlFor="cpf" className="block text-sm font-semibold text-gray-700 mb-1">
              CPF do Titular
            </label>
            <div className="relative">
              <input
                id="cpf"
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className={`w-full px-4 py-3 bg-gray-50 border ${error ? 'border-red-500 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'} rounded-lg focus:outline-none focus:ring-4 transition-all text-lg tracking-wider font-medium`}
                required
              />
              <Search className="absolute right-3 top-3.5 text-gray-400 w-5 h-5" />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 flex items-start space-x-3 rounded">
              <AlertCircle className="text-red-500 w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg shadow-lg shadow-blue-200 transition-all flex justify-center items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Acessar Formulário</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-100">
          <div className="flex items-start space-x-3 text-xs text-gray-400 leading-relaxed">
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
