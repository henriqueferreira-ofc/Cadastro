
import { BaseAutorizada, CadastroEnviado } from './types';

// CPFs extraídos da imagem fornecida para validação oficial
const CPFS_OFICIAIS = [
  '64527989104', '44223309404', '68810499187', '12549318187', '57843688134', '68194153115', 
  '88891253868', '48971031168', '73191368134', '57388325115', '60222581115', '61977631549', 
  '96425121204', '73531668134', '27932331549', '00150853134', '18410948168', '63259292120', 
  '58494140253', '38118123204', '01241586704', '05539511952', '53611952287', '49290711272', 
  '56646275215', '82135002715', '51177447215', '63707942287', '27362300244', '60128224191', 
  '60155823191', '88166432120', '63397395215', '58425248291', '41706509287', '53122617220', 
  '60037434272', '23533633268', '45596432291', '33543823115', '58189814153', '60704743134', 
  '51288339104', '84509188753', '70028614153', '91226043115', '81079347287', '61328741215', 
  '23009228253', '42715061220', '69340274253', '58367838202', '03048752702', '00213121115', 
  '63677737153', '75556694204', '81304021204', '91336001510', '81054044220', '02108139415', 
  '59734994220', '89753005204', '30113273702', '07934816215', '24904533268', '86413320525', 
  '67137788530', '42082243291', '56440847287', '48332962100', '39436021202', '38971411220', 
  '60031231234', '64919323234', '33621814115', '49013233291', '58748831115', '68845014134', 
  '05354519234', '49301100291', '80422231204', '46812005202', '53433593115', '46060151120', 
  '52366472215', '15072471120', '63183201115', '17059043204', '54243911220', '76033431115', 
  '68032110104', '81216107415', '36340643115', '80567408100', '61343193100', '43533601520', 
  '79367121120', '22225651204', '87783853434', '73789452115', '88686953115', '78783493115', 
  '49058201153', '81621535415', '80511745104', '55322043115', '84323282204', '12345678909'
];

const INITIAL_BASE: BaseAutorizada[] = CPFS_OFICIAIS.map(cpf => ({
  cpf,
  nome: `TITULAR - ${cpf.substring(0, 3)}...${cpf.substring(9)}`,
  estado: 'SP',
  turma_cesd: '2024/2',
  rg: `${Math.floor(Math.random() * 99999999)}`,
  cadastro_realizado: false
}));

export const DBService = {
  init: () => {
    if (!localStorage.getItem('base_autorizada')) {
      localStorage.setItem('base_autorizada', JSON.stringify(INITIAL_BASE));
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

  resetData: () => {
    localStorage.removeItem('base_autorizada');
    localStorage.removeItem('cadastros_enviados');
    DBService.init();
    window.location.reload();
  }
};
