
import { BaseAutorizada, CadastroEnviado } from './types';
import { CPFS_OFICIAIS } from './authorized_cpfs';


let loadedCpfs: string[] = [];

const BACKEND_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api';

export const DBService = {
  init: () => {
    if (!localStorage.getItem('cadastros_enviados')) {
      localStorage.setItem('cadastros_enviados', JSON.stringify([]));
    }
  },

  loadAuthorizedCPFs: async (): Promise<boolean> => {
    try {
      const response = await fetch('./authorized_cpfs.json');
      if (!response.ok) throw new Error('Falha ao carregar base de CPFs');
      loadedCpfs = await response.json();
      return true;
    } catch (error) {
      console.error('Erro ao carregar CPFs:', error);
      // Fallback for development if file is missing in public
      loadedCpfs = CPFS_OFICIAIS;
      return false;
    }
  },

  getBase: (): BaseAutorizada[] => {
    const cpfs = loadedCpfs.length > 0 ? loadedCpfs : CPFS_OFICIAIS;
    const enviados = DBService.getEnviados();
    const cpfsEnviados = new Set(enviados.map(e => e.cpf));

    return cpfs.map(cpf => ({
      cpf,
      nome: `AUTORIZADO - ${cpf.substring(0, 3)}.***.${cpf.substring(9)}`,
      estado: 'SP',
      turma_cesd: '2024/2',
      rg: 'N/A',
      cadastro_realizado: cpfsEnviados.has(cpf)
    }));
  },

  getEnviados: (): CadastroEnviado[] => {
    try {
      return JSON.parse(localStorage.getItem('cadastros_enviados') || '[]');
    } catch (e) {
      return [];
    }
  },

  checkCPF: (cpf: string): { success: boolean; data?: BaseAutorizada; error?: string } => {
    const cleanCpf = cpf.replace(/\D/g, '');
    const cpfs = loadedCpfs.length > 0 ? loadedCpfs : CPFS_OFICIAIS;

    const isAuthorized = cpfs.includes(cleanCpf);

    if (!isAuthorized) {
      return {
        success: false,
        error: 'CPF não autorizado para cadastro.'
      };
    }

    const enviados = DBService.getEnviados();
    const existingCadastro = enviados.find(e => e.cpf === cleanCpf);

    return {
      success: true,
      data: {
        cpf: cleanCpf,
        nome: existingCadastro?.nome || `AUTORIZADO - ${cleanCpf.substring(0, 3)}.***.${cleanCpf.substring(9)}`,
        estado: existingCadastro?.estado || 'SP',
        turma_cesd: existingCadastro?.turma_cesd || '2024/2',
        rg: existingCadastro?.rg || 'N/A',
        cadastro_realizado: !!existingCadastro
      }
    };
  },

  saveRegistration: async (data: Omit<CadastroEnviado, 'id' | 'data_envio' | 'status'>): Promise<{ success: boolean; error?: string }> => {
    try {
      // Logic for local backup (optional)
      const enviados = DBService.getEnviados();
      const index = enviados.findIndex(e => e.cpf === data.cpf);
      const record = { ...data, status: 'CONCLUÍDO', data_envio: new Date().toISOString() };

      let updatedEnviados;
      if (index >= 0) {
        updatedEnviados = [...enviados];
        updatedEnviados[index] = { ...enviados[index], ...record };
      } else {
        updatedEnviados = [...enviados, { ...record, id: enviados.length + 1 }];
      }
      localStorage.setItem('cadastros_enviados', JSON.stringify(updatedEnviados));

      // NEW: Backend Call
      const result = await fetch(`${BACKEND_URL}/cadastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro na comunicação com o servidor.');
      }

      return { success: true };
    } catch (e: any) {
      console.error('Erro ao salvar:', e);
      return { success: false, error: e.message || 'Erro ao salvar cadastro.' };
    }
  },

  updateAuthorizedBase: (_newCpfs: string[]): { success: boolean; count: number; error?: string } => {
    return { success: true, count: 0 };
  },

  resetData: () => {
    localStorage.removeItem('base_autorizada');
    localStorage.removeItem('cadastros_enviados');
    DBService.init();
    window.location.reload();
  }
};
