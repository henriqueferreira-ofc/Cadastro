
export interface BaseAutorizada {
  cpf: string;
  nome: string;
  estado: string;
  turma_cesd: string;
  rg: string;
  cadastro_realizado: boolean;
}

export interface CadastroEnviado {
  id: number;
  nome: string;
  estado: string;
  turma_cesd: string;
  rg: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  cep: string;
  data_envio: string;
  status: string;
}

export type ViewState = 'AUTH' | 'FORM' | 'SUCCESS' | 'ADMIN';
