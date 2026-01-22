export const normalizeCpf = (cpf: string | string[] | undefined): string => {
  const value = Array.isArray(cpf) ? cpf[0] : cpf;
  return (value || '').replace(/\D/g, '');
};
