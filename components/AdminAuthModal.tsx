import React, { useState } from 'react';
import { Lock, X, ChevronRight } from 'lucide-react';
import { getBackendUrl } from '../utils';

interface AdminAuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ onSuccess, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const backendUrl = getBackendUrl();
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...init, signal: controller.signal });
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    // Render (plano free) pode hibernar. Em produção, tentamos algumas vezes antes de falhar.
    const maxAttempts = isLocalhost ? 1 : 6;
    const retryDelaysMs = [0, 1500, 2500, 4000, 6000, 8000];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await sleep(retryDelaysMs[Math.min(attempt, retryDelaysMs.length - 1)]);

      try {
        // Tentar sempre o backend primeiro para obter o token real (JWT)
        const response = await fetchWithTimeout(
          `${backendUrl}/auth/login`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
          },
          12_000,
        );

        const data = await response.json().catch(() => ({}) as any);

        if (response.ok && data?.success && data?.token) {
          // Sucesso com o backend (JWT real)
          localStorage.setItem('admin_token', data.token);
          onSuccess();
          onClose();
          return;
        }

        // Se for erro de servidor/transiente, tentar novamente (provável cold start)
        const shouldRetry = !response.ok && response.status >= 500 && response.status <= 599;
        if (shouldRetry && attempt < maxAttempts - 1) continue;

        // Em produção, não podemos cair no token local (backend sempre exige JWT)
        if (!isLocalhost) {
          setError(
            data?.error ||
              'Acesso negado (401). Verifique a senha do admin no Render (ADMIN_PASSWORD).',
          );
          return;
        }
      } catch (err) {
        // Falha de rede/timeout durante cold start: tentar novamente.
        console.log('Backend indisponível para login (rede/timeout), tentando novamente...');
        if (attempt < maxAttempts - 1) continue;

        if (!isLocalhost) {
          setError(
            'Servidor indisponível. No plano free do Render a API pode demorar 30–60s para iniciar. Aguarde e tente novamente.',
          );
          return;
        }

        setError(
          'Servidor indisponível. Inicie o backend para ver os dados do banco (ex: npm run dev:all).',
        );
        return;
      }
    }

    // Fallback local apenas em localhost (dev)
    if (isLocalhost && password === 'AAFAB@2026#Secure!') {
      localStorage.setItem('admin_token', 'local_admin_access');
      onSuccess();
      onClose();
      return;
    }

    setError('Senha incorreta.');
    setPassword('');
    return;
  };

  // Garante que o loading sempre seja finalizado, mesmo com retornos antecipados
  // (feito via wrapper abaixo para manter o handleSubmit legível)
  const handleSubmitWithFinally = async (e: React.FormEvent) => {
    try {
      await handleSubmit(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-blue-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative animate-in zoom-in-95 duration-300">
        <button
          onClick={onClose}
          aria-label="Fechar"
          title="Fechar"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">Área Restrita</h2>
          <p className="text-sm text-center text-gray-500 mb-6">
            Informe a senha administrativa para acessar o painel.
          </p>

          <form onSubmit={handleSubmitWithFinally}>
            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Senha de acesso"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-center font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-red-500 text-xs text-center font-bold bg-red-50 py-2 rounded-lg border border-red-100 animate-in shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <span>{loading ? 'Conectando...' : 'Acessar Painel'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
        <div className="bg-gray-50 px-8 py-4 text-center border-t border-gray-100">
          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
            Acesso Exclusivo
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminAuthModal;
