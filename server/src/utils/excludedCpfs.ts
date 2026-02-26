const toCpfDigits = (value: string) => String(value || '').replace(/\D/g, '');

// CPFs que devem receber uma mensagem específica ao consultar (admin e público)
// e não devem ter acesso/liberação.
const EXCLUDED_CPFS = new Set<string>([
  '33706646234',
  '26157642840',
  '62137620359',
  '58450734134',
  '94322619568',
  '03253532631',
  '05137251720',
  '55870074304',
  '51012111334',
  '88144771672',
  '02286495440',
  '03190280622',
  '61467758272',
  '58633790220',
  '92232108015',
  '63736870078',
  '97961396691',
  '87422301104',
]);

export const EXCLUDED_CPF_MESSAGE =
  'Por decisão do Conselho Deliberativo e com base no Estatuto da AAFAB, (O referido CPF não consta mais do banco de dados da AAFAB).';

export const isCpfExcluded = (cpfDigits: string): boolean => {
  const clean = toCpfDigits(cpfDigits);
  if (clean.length !== 11) return false;
  return EXCLUDED_CPFS.has(clean);
};
