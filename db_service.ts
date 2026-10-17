import { BaseAutorizada, CadastroEnviado } from './types';
import { getBackendUrl } from './utils';

const BACKEND_URL = getBackendUrl();
const isProduction = !['localhost', '127.0.0.1'].includes(window.location.hostname);

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

type CheckCpfResult = { success: boolean; data?: BaseAutorizada; error?: string };

export const DBService = {
  checkCPFAsync: async (cpf: string, accessCode: string): Promise<CheckCpfResult> => {
    try {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/auth/registration-access`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), accessCode }),
        },
        isProduction ? 60_000 : 12_000,
      );
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.eligible || typeof result.registrationToken !== 'string') {
        return {
          success: false,
          error:
            result?.message ||
            result?.error ||
            'Não foi possível iniciar o cadastro. Solicite orientação à Secretaria da AAFAB.',
        };
      }

      return {
        success: true,
        data: {
          cpf: cpf.replace(/\D/g, ''),
          nome: '',
          estado: '',
          turma_cesd: '',
          rg: '',
          cadastro_realizado: false,
          registrationToken: result.registrationToken,
        },
      };
    } catch {
      return {
        success: false,
        error: 'Servidor indisponível no momento. Aguarde alguns instantes e tente novamente.',
      };
    }
  },

  saveRegistration: async (
    data: Omit<CadastroEnviado, 'id' | 'data_envio' | 'status'>,
    registrationToken: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetchWithTimeout(
        `${BACKEND_URL}/cadastro`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${registrationToken}`,
          },
          body: JSON.stringify(data),
        },
        20_000,
      );
      const result = await response.json().catch(() => null);
      return response.ok
        ? { success: true }
        : { success: false, error: result?.error || 'Não foi possível concluir o cadastro.' };
    } catch {
      return { success: false, error: 'Servidor indisponível. Tente novamente em instantes.' };
    }
  },

  prewarmBackend: async (): Promise<void> => {
    if (!isProduction) return;
    try {
      const origin = BACKEND_URL.replace(/\/api\/?$/, '');
      await fetchWithTimeout(`${origin}/health`, { method: 'GET' }, 10_000);
    } catch {
      // A tela continua disponível enquanto o serviço inicia.
    }
  },
};
