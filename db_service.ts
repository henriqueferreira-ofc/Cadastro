
import { BaseAutorizada, CadastroEnviado } from './types';
import { CPFS_OFICIAIS } from './authorized_cpfs';

const INITIAL_BASE: BaseAutorizada[] = [];

export const DBService = {
  init: () => {
    if (!localStorage.getItem('cadastros_enviados')) {
      localStorage.setItem('cadastros_enviados', JSON.stringify([]));
    }
  },

  getBase: (): BaseAutorizada[] => {
    const enviados = DBService.getEnviados();
    const cpfsEnviados = new Set(enviados.map(e => e.cpf));

    return CPFS_OFICIAIS.map(cpf => ({
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

    // Prioridade total para a lista embutida
    const isAuthorized = CPFS_OFICIAIS.includes(cleanCpf);

    if (!isAuthorized) {
      return {
        success: false,
        error: 'CPF não autorizado para cadastro.'
      };
    }

    const enviados = DBService.getEnviados();
    const userAlreadyRegistered = enviados.some(e => e.cpf === cleanCpf);

    if (userAlreadyRegistered) {
      return {
        success: false,
        error: 'O cadastro para este CPF já foi realizado e processado anteriormente.'
      };
    }

    return {
      success: true,
      data: {
        cpf: cleanCpf,
        nome: `AUTORIZADO - ${cleanCpf.substring(0, 3)}.***.${cleanCpf.substring(9)}`,
        estado: 'SP',
        turma_cesd: '2024/2',
        rg: 'N/A',
        cadastro_realizado: false
      }
    };
  },

  saveRegistration: (data: Omit<CadastroEnviado, 'id' | 'data_envio' | 'status'>): { success: boolean; error?: string } => {
    const base = DBService.getBase();
    const enviados = DBService.getEnviados();

    if (enviados.some(e => e.cpf === data.cpf)) {
      return { success: false, error: 'Tentativa de duplicidade bloqueada: CPF já cadastrado.' };
    }

    const newRecord: CadastroEnviado = {
      ...data,
      id: enviados.length + 1,
      data_envio: new Date().toISOString(),
      status: 'CONCLUÍDO'
    };

    const updatedEnviados = [...enviados, newRecord];
    localStorage.setItem('cadastros_enviados', JSON.stringify(updatedEnviados));

    return { success: true };
  },

  updateAuthorizedBase: (_newCpfs: string[]): { success: boolean; count: number; error?: string } => {
    // Agora estático, não precisa mais salvar CPFs no LocalStorage
    return { success: true, count: 0 };
  },

  resetData: () => {
    localStorage.removeItem('base_autorizada');
    localStorage.removeItem('cadastros_enviados');
    DBService.init();
    window.location.reload();
  }
};
