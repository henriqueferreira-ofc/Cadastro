
export interface BaseAutorizada {
  cpf: string;
  nome: string;
  estado: string;
  turma_cesd: string;
  rg: string;
  certidao_obito?: string;
  cadastro_realizado: boolean;
}

export interface CadastroEnviado {
  id: number;
  nome: string;
  estado: string;
  turma_cesd: string;
  rg: string;
  certidao_obito?: string;
  cpf: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  data_envio: string;
  status: string;
}

export type ViewState = 'AUTH' | 'FORM' | 'SUCCESS' | 'ADMIN';
