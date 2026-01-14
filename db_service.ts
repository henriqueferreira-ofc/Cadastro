
import { BaseAutorizada, CadastroEnviado } from './types';
import { CPFS_OFICIAIS } from './authorized_cpfs';

const INITIAL_BASE: BaseAutorizada[] = [];

export const DBService = {
  init: () => {
    // Forçar sincronização com a base embutida sempre que o App iniciar
    console.log('Verificando integridade da base de CPFs...');
    if (Array.isArray(CPFS_OFICIAIS) && CPFS_OFICIAIS.length > 0) {
      const { count } = DBService.updateAuthorizedBase(CPFS_OFICIAIS);
      if (count > 0) {
        console.log(`${count} novos CPFs autorizados foram sincronizados.`);
      }
    } else {
      console.error('Erro crítico: Lista de CPFs oficiais está vazia ou indefinida.');
    }

    if (!localStorage.getItem('cadastros_enviados')) {
      localStorage.setItem('cadastros_enviados', JSON.stringify([]));
    }
  },

  getBase: (): BaseAutorizada[] => {
    try {
      return JSON.parse(localStorage.getItem('base_autorizada') || '[]');
    } catch (e) {
      return [];
    }
  },

  getEnviados: (): CadastroEnviado[] => {
    try {
      return JSON.parse(localStorage.getItem('cadastros_enviados') || '[]');
    } catch (e) {
      return [];
    }
  },

  checkCPF: (cpf: string): { success: boolean; data?: BaseAutorizada; error?: string } => {
    const base = DBService.getBase();
    const cleanCpf = cpf.replace(/\D/g, '');
    const user = base.find(u => u.cpf === cleanCpf);

    if (!user) {
      return { success: false, error: 'Acesso negado: Este CPF não consta na lista oficial de autorizados para atualização.' };
    }
    if (user.cadastro_realizado) {
      return { success: false, error: 'O cadastro para este CPF já foi realizado e processado anteriormente.' };
    }

    return { success: true, data: user };
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

    const updatedBase = base.map(u => u.cpf === data.cpf ? { ...u, cadastro_realizado: true } : u);
    const updatedEnviados = [...enviados, newRecord];

    localStorage.setItem('base_autorizada', JSON.stringify(updatedBase));
    localStorage.setItem('cadastros_enviados', JSON.stringify(updatedEnviados));

    return { success: true };
  },

  updateAuthorizedBase: (newCpfs: string[]): { success: boolean; count: number; error?: string } => {
    try {
      const currentBase = DBService.getBase();
      const existingCpfs = new Set(currentBase.map(u => u.cpf));

      let addedCount = 0;
      const newEntries: BaseAutorizada[] = [];

      newCpfs.forEach(rawCpf => {
        let cleanCpf = rawCpf.replace(/\D/g, '');

        if (cleanCpf.length > 0 && cleanCpf.length < 11) {
          cleanCpf = cleanCpf.padStart(11, '0');
        }

        if (cleanCpf.length === 11 && !existingCpfs.has(cleanCpf)) {
          newEntries.push({
            cpf: cleanCpf,
            nome: `AUTORIZADO - ${cleanCpf.substring(0, 3)}.***.${cleanCpf.substring(9)}`,
            estado: 'SP',
            turma_cesd: '2024/2',
            rg: 'N/A',
            cadastro_realizado: false
          });
          existingCpfs.add(cleanCpf);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        const updatedBase = [...currentBase, ...newEntries];
        localStorage.setItem('base_autorizada', JSON.stringify(updatedBase));
      }

      return { success: true, count: addedCount };
    } catch (e) {
      return { success: false, count: 0, error: 'Erro ao atualizar base de dados.' };
    }
  },

  resetData: () => {
    localStorage.removeItem('base_autorizada');
    localStorage.removeItem('cadastros_enviados');
    DBService.init();
    window.location.reload();
  }
};
