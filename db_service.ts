import { BaseAutorizada, CadastroEnviado } from './types';
import { CPFS_OFICIAIS } from './authorized_cpfs';
import { getBackendUrl } from './utils';

let loadedCpfs: string[] = [];

const BACKEND_URL = getBackendUrl();

// Verificar se estamos em produção
const isProduction =
  window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

type EligibilityResponse = {
  cpf: string;
  eligible: boolean;
  status: 'ACTIVE' | 'BLOCKED' | string;
  unlockedAt?: string | null;
  hasCadastro?: boolean;
  error?: string;
};

type CheckCpfResult = { success: boolean; data?: BaseAutorizada; error?: string; code?: string };

export const DBService = {
  init: () => {
    if (!localStorage.getItem('cadastros_enviados')) {
      localStorage.setItem('cadastros_enviados', JSON.stringify([]));
    }
  },

  loadAuthorizedCPFs: async (): Promise<boolean> => {
    const parseJsonCpfArray = (data: unknown): string[] => {
      if (!Array.isArray(data)) return [];
      const seen = new Set<string>();
      const result: string[] = [];
      for (const item of data) {
        const clean = String(item || '').replace(/\D/g, '');
        if (clean.length !== 11) continue;
        if (seen.has(clean)) continue;
        seen.add(clean);
        result.push(clean);
      }
      return result;
    };

    try {
      const parseCsv = (csvText: string): string[] => {
        const lines = csvText
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        // Remove header if present
        const dataLines = lines[0]?.toLowerCase() === 'cpf' ? lines.slice(1) : lines;

        const seen = new Set<string>();
        const result: string[] = [];

        for (const line of dataLines) {
          const clean = line.replace(/\D/g, '');
          if (clean.length !== 11) continue;
          if (seen.has(clean)) continue;
          seen.add(clean);
          result.push(clean);
        }

        return result;
      };

      // Fonte única: CSV publicado em /public
      const csvResponse = await fetch('/ENVIAR.csv');
      if (!csvResponse.ok) throw new Error('Falha ao carregar base de CPFs');

      const csvText = await csvResponse.text();
      const cpfs = parseCsv(csvText);
      loadedCpfs = cpfs;
      return true;
    } catch (error) {
      console.error('Erro ao carregar CPFs:', error);

      // Fallback: tenta carregar JSON (public/authorized_cpfs.json)
      try {
        const jsonResponse = await fetch('/authorized_cpfs.json');
        if (jsonResponse.ok) {
          const jsonData = (await jsonResponse.json()) as unknown;
          const cpfs = parseJsonCpfArray(jsonData);
          if (cpfs.length > 0) {
            loadedCpfs = cpfs;
            return true;
          }
        }
      } catch (jsonError) {
        console.error('Erro ao carregar CPFs via JSON:', jsonError);
      }

      // Último fallback (dev): lista embutida (pode estar vazia)
      loadedCpfs = CPFS_OFICIAIS;
      return false;
    }
  },

  getBase: (): BaseAutorizada[] => {
    const cpfs = loadedCpfs.length > 0 ? loadedCpfs : CPFS_OFICIAIS;
    const enviados = DBService.getEnviados();
    const cpfsEnviados = new Set(enviados.map((e) => e.cpf));

    return cpfs.map((cpf) => ({
      cpf,
      nome: `AUTORIZADO - ${cpf.substring(0, 3)}.***.${cpf.substring(9)}`,
      estado: 'SP',
      turma_cesd: '2024/2',
      rg: 'N/A',
      cadastro_realizado: cpfsEnviados.has(cpf),
    }));
  },

  getEnviados: (): CadastroEnviado[] => {
    try {
      return JSON.parse(localStorage.getItem('cadastros_enviados') || '[]');
    } catch (e) {
      return [];
    }
  },

  checkCPF: (cpf: string): CheckCpfResult => {
    // OBS: Mantido por compatibilidade com chamadas antigas.
    // Em produção, o login deve usar checkCPFAsync (backend eligibility).
    const cleanCpf = cpf.replace(/\D/g, '');
    const enviados = DBService.getEnviados();
    const existingCadastro = enviados.find((e) => e.cpf === cleanCpf);

    // Se já existe cadastro local, permitir acesso mesmo fora da lista oficial
    // (isso evita bloquear quem já estava cadastrado antes de atualizar a base)
    if (existingCadastro) {
      return {
        success: true,
        data: {
          cpf: cleanCpf,
          nome: existingCadastro.nome || '',
          estado: existingCadastro.estado || 'SP',
          turma_cesd: existingCadastro.turma_cesd || '2024/2',
          rg: existingCadastro.rg || 'N/A',
          cadastro_realizado: true,
        },
      };
    }

    const cpfs = loadedCpfs.length > 0 ? loadedCpfs : CPFS_OFICIAIS;
    const isAuthorized = cpfs.includes(cleanCpf);

    if (!isAuthorized) {
      return {
        success: false,
        error: 'CPF não faz parte do sistema (não está na lista AAFAB).',
        code: 'CPF_NOT_IN_SYSTEM',
      };
    }

    return {
      success: false,
      error:
        'CPF bloqueado. Após o pagamento, apresente o comprovante para o Lider do Estado e terá liberação da AAFAB.',
    };
  },

  checkCPFAsync: async (
    cpf: string,
  ): Promise<CheckCpfResult> => {
    const cleanCpf = cpf.replace(/\D/g, '');

    try {
      const response = await fetch(`${BACKEND_URL}/auth/eligibility/${cleanCpf}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}) as any);
        return {
          success: false,
          error: errorData?.error || 'Não foi possível validar o CPF.',
          code: typeof errorData?.code === 'string' ? errorData.code : undefined,
        };
      }

      const eligibility = (await response.json()) as EligibilityResponse;

      if (!eligibility.eligible) {
        return {
          success: false,
          error:
            'CPF bloqueado. Após o pagamento, apresente o comprovante para o Lider do Estado e terá liberação da AAFAB.',
        };
      }

      const enviados = DBService.getEnviados();
      const existingCadastro = enviados.find((e) => e.cpf === cleanCpf);
      const hasCadastro = Boolean(eligibility.hasCadastro) || Boolean(existingCadastro);

      return {
        success: true,
        data: {
          cpf: cleanCpf,
          nome: existingCadastro?.nome || '',
          estado: existingCadastro?.estado || 'SP',
          turma_cesd: existingCadastro?.turma_cesd || '2024/2',
          rg: existingCadastro?.rg || 'N/A',
          cadastro_realizado: hasCadastro,
        },
      };
    } catch (error) {
      console.warn('Erro ao consultar eligibility no backend:', error);

      // Em produção: nunca liberar por fallback (evita bypass de segurança).
      if (isProduction) {
        return {
          success: false,
          error: 'Servidor indisponível no momento. Tente novamente em instantes.',
        };
      }

      // Em desenvolvimento: fallback opcional para facilitar testes locais.
      return DBService.checkCPF(cleanCpf);
    }
  },

  saveRegistration: async (
    data: Omit<CadastroEnviado, 'id' | 'data_envio' | 'status'>,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Tentar salvar no backend sempre primeiro
      try {
        const result = await fetch(`${BACKEND_URL}/cadastro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (result.ok) {
          const backendData = await result.json();

          // Sincronizar com localStorage para visualização rápida posterior
          const enviados = DBService.getEnviados();
          const index = enviados.findIndex((e) => e.cpf === data.cpf);
          const record = {
            ...backendData,
            status: backendData.status || 'CONCLUÍDO',
            data_envio: backendData.data_envio || new Date().toISOString(),
          };

          let updatedEnviados;
          if (index >= 0) {
            updatedEnviados = [...enviados];
            updatedEnviados[index] = { ...enviados[index], ...record };
          } else {
            updatedEnviados = [...enviados, { ...record, id: backendData.id || Date.now() }];
          }
          localStorage.setItem('cadastros_enviados', JSON.stringify(updatedEnviados));
          return { success: true };
        } else {
          const errorData = await result.json().catch(() => ({}));
          console.error('Erro retornado pelo backend:', errorData);
          // Se for erro de validação (ex: CPF já existe), repassamos o erro
          if (result.status === 400) {
            return { success: false, error: errorData.error || 'Erro na submissão.' };
          }

          // Bloqueado por mensalidade (regra do backend)
          if (result.status === 403) {
            return { success: false, error: errorData.error || 'CPF bloqueado para cadastro.' };
          }

          return { success: false, error: errorData.error || 'Erro ao salvar cadastro.' };
        }
      } catch (backendError) {
        console.warn(
          '⚠️ Backend não disponível para salvar cadastro. Usando localStorage...',
          backendError,
        );

        // Em produção, não fazemos fallback para localStorage (evita bypass de bloqueio)
        if (isProduction) {
          return {
            success: false,
            error: 'Servidor indisponível no momento. Tente novamente em instantes.',
          };
        }
      }

      // Fallback: Salvar apenas no localStorage se backend falhar
      const enviados = DBService.getEnviados();
      const index = enviados.findIndex((e) => e.cpf === data.cpf);
      const record = {
        ...data,
        status: 'OFFLINE',
        data_envio: new Date().toISOString(),
        id: index >= 0 ? enviados[index].id : Date.now(),
      };

      let updatedEnviados;
      if (index >= 0) {
        updatedEnviados = [...enviados];
        updatedEnviados[index] = { ...enviados[index], ...record };
      } else {
        updatedEnviados = [...enviados, record];
      }
      localStorage.setItem('cadastros_enviados', JSON.stringify(updatedEnviados));

      console.warn('⚠️ Cadastro salvo localmente. Backend não está acessível no momento.');
      return { success: true };
    } catch (e: any) {
      console.error('Erro ao salvar registro:', e);
      return { success: false, error: e.message || 'Erro ao processar cadastro.' };
    }
  },

  // Nova função: buscar dados do backend por CPF
  getCadastroFromBackend: async (cpf: string): Promise<CadastroEnviado | null> => {
    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      const response = await fetch(`${BACKEND_URL}/cadastro/consulta/${cleanCpf}`);

      if (!response.ok) {
        // Se estiver bloqueado, não retorna dados
        if (response.status === 403) {
          return null;
        }
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao buscar cadastro do backend:', error);
      return null;
    }
  },

  updateAuthorizedBase: (
    _newCpfs: string[],
  ): { success: boolean; count: number; error?: string } => {
    return { success: true, count: 0 };
  },

  resetData: () => {
    localStorage.removeItem('base_autorizada');
    localStorage.removeItem('cadastros_enviados');
    DBService.init();
    window.location.reload();
  },
};
