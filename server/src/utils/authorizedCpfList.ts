import fs from 'node:fs';
import path from 'node:path';

let cachedSet: Set<string> | null = null;
let cachedAt = 0;

const CACHE_TTL_MS = 60_000;

const toCpfDigits = (value: string) => String(value || '').replace(/\D/g, '');

const readCpfListFromFile = (filePath: string): string[] => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('authorized_cpfs.json deve ser um array de CPFs.');
  }

  return parsed.map((v) => toCpfDigits(String(v))).filter((v) => v.length === 11);
};

const getCandidates = (): string[] => {
  // Em execução normal, o cwd é a pasta `server/`.
  // O arquivo oficial fica na raiz do repositório: `../authorized_cpfs.json`.
  return [
    path.resolve(process.cwd(), '../authorized_cpfs.json'),
    path.resolve(process.cwd(), '../public/authorized_cpfs.json'),
    path.resolve(process.cwd(), 'authorized_cpfs.json'),
  ];
};

export const getAuthorizedCpfSet = (): Set<string> => {
  const now = Date.now();
  if (cachedSet && now - cachedAt < CACHE_TTL_MS) return cachedSet;

  const candidates = getCandidates();
  let list: string[] | null = null;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      list = readCpfListFromFile(candidate);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!list) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError || '');
    throw new Error(
      `Não foi possível carregar a lista oficial de CPFs (authorized_cpfs.json). ${detail}`.trim(),
    );
  }

  cachedSet = new Set(list);
  cachedAt = now;
  return cachedSet;
};

export const isCpfInAuthorizedList = (cpfDigits: string): boolean => {
  const clean = toCpfDigits(cpfDigits);
  if (clean.length !== 11) return false;
  return getAuthorizedCpfSet().has(clean);
};
