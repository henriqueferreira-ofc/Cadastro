
import { BaseAutorizada, CadastroEnviado } from './types';

import { CPFS_OFICIAIS } from './authorized_cpfs';

const INITIAL_BASE: BaseAutorizada[] = [];

export const DBService = {
  init: () => {
    if (!localStorage.getItem('base_autorizada')) {
      localStorage.setItem('base_autorizada', JSON.stringify(INITIAL_BASE));

      // Tentativa automática de popular a base autorizada:
      // 1) Se o arquivo `authorized_cpfs.ts` exportar CPFs (embutido), usa ele;
      // 2) Caso contrário tenta buscar um arquivo estático em `/authorized_cpfs.json` (public).
      if (Array.isArray(CPFS_OFICIAIS) && CPFS_OFICIAIS.length > 0) {
        DBService.updateAuthorizedBase(CPFS_OFICIAIS);
      } else {
        try {
          fetch('/authorized_cpfs.json')
            .then(res => {
              if (!res.ok) throw new Error('Arquivo não encontrado');
              return res.json();
            })
            .then((data) => {
              if (Array.isArray(data) && data.length > 0) {
                DBService.updateAuthorizedBase(data.map(String));
              }
            })
            .catch(() => {
              // silencioso — se não existir, seguimos com a base vazia
            });
        } catch (e) {
          // ignore
        }
      }
    }
    if (!localStorage.getItem('cadastros_enviados')) {
      localStorage.setItem('cadastros_enviados', JSON.stringify([]));
    }
  },

  getBase: (): BaseAutorizada[] => {
    return JSON.parse(localStorage.getItem('base_autorizada') || '[]');
  },

  getEnviados: (): CadastroEnviado[] => {
    return JSON.parse(localStorage.getItem('cadastros_enviados') || '[]');
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

        // Fix: Pad with leading zeros if length is less than 11 (common Excel issue)
        if (cleanCpf.length > 0 && cleanCpf.length < 11) {
          cleanCpf = cleanCpf.padStart(11, '0');
        }

        if (cleanCpf.length === 11 && !existingCpfs.has(cleanCpf)) {
          newEntries.push({
            cpf: cleanCpf,
            nome: `AUTORIZADO - ${cleanCpf.substring(0, 3)}.***.${cleanCpf.substring(9)}`, // Placeholder name since we only have CPF
            estado: 'SP', // Default assignment, can be edited later if needed
            turma_cesd: '2024/2',
            rg: 'N/A',
            cadastro_realizado: false
          });
          existingCpfs.add(cleanCpf);
          addedCount++;
        }
      });

      if (addedCount === 0) {
        return { success: true, count: 0, error: 'Nenhum CPF novo foi adicionado. Todos já existiam ou eram inválidos.' };
      }

      const updatedBase = [...currentBase, ...newEntries];
      localStorage.setItem('base_autorizada', JSON.stringify(updatedBase));

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
