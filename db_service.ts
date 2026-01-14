
import { BaseAutorizada, CadastroEnviado } from './types';
import { CPFS_OFICIAIS } from './authorized_cpfs';


let loadedCpfs: string[] = [];

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

  saveRegistration: (data: Omit<CadastroEnviado, 'id' | 'data_envio' | 'status'>): { success: boolean; error?: string } => {
    const enviados = DBService.getEnviados();

    // Logic for update: if already exists, replace it
    const index = enviados.findIndex(e => e.cpf === data.cpf);

    const record: CadastroEnviado = {
      ...data,
      id: index >= 0 ? enviados[index].id : enviados.length + 1,
      data_envio: new Date().toISOString(),
      status: 'CONCLUÍDO'
    };

    let updatedEnviados;
    if (index >= 0) {
      updatedEnviados = [...enviados];
      updatedEnviados[index] = record;
    } else {
      updatedEnviados = [...enviados, record];
    }

    localStorage.setItem('cadastros_enviados', JSON.stringify(updatedEnviados));

    return { success: true };
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
