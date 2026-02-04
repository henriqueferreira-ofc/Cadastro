import fs from 'node:fs';
import path from 'node:path';

let cachedSet: Set<string> | null = null;
let cachedAt = 0;

const CACHE_TTL_MS = 60_000;

const toCpfDigits = (value: string) => String(value || '').replace(/\D/g, '');

const readCpfListFromJson = (filePath: string): string[] => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error('authorized_cpfs.json deve ser um array de CPFs.');
  }

  return parsed.map((v) => toCpfDigits(String(v))).filter((v) => v.length === 11);
};

const readCpfListFromCsv = (filePath: string): string[] => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dataLines = lines[0]?.toLowerCase() === 'cpf' ? lines.slice(1) : lines;

  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of dataLines) {
    const clean = toCpfDigits(line);
    if (clean.length !== 11) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
  }

  return result;
};

const readCpfListFromFile = (filePath: string): string[] => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') return readCpfListFromCsv(filePath);
  return readCpfListFromJson(filePath);
};

const getCandidates = (): string[] => {
  // Em execução normal, o cwd é a pasta `server/`.
  // A lista oficial pode existir como JSON (authorized_cpfs.json) ou CSV (public/ENVIAR.csv).
  return [
    path.resolve(process.cwd(), '../authorized_cpfs.json'),
    path.resolve(process.cwd(), '../public/authorized_cpfs.json'),
    path.resolve(process.cwd(), '../public/ENVIAR.csv'),
    path.resolve(process.cwd(), 'authorized_cpfs.json'),
    path.resolve(process.cwd(), 'ENVIAR.csv'),
  ];
};

export const getAuthorizedCpfSet = (): Set<string> => {
  const now = Date.now();
  if (cachedSet && now - cachedAt < CACHE_TTL_MS) return cachedSet;

  const candidates = getCandidates();
  const merged = new Set<string>();
  let loadedAtLeastOne = false;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const list = readCpfListFromFile(candidate);
      if (list.length === 0) continue;
      loadedAtLeastOne = true;
      for (const cpf of list) merged.add(cpf);
    } catch (err) {
      lastError = err;
    }
  }

  if (!loadedAtLeastOne || merged.size === 0) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError || '');
    throw new Error(
      `Não foi possível carregar a lista oficial de CPFs (authorized_cpfs.json/ENVIAR.csv). ${detail}`.trim(),
    );
  }

  cachedSet = merged;
  cachedAt = now;
  return cachedSet;
};

export const isCpfInAuthorizedList = (cpfDigits: string): boolean => {
  const clean = toCpfDigits(cpfDigits);
  if (clean.length !== 11) return false;
  return getAuthorizedCpfSet().has(clean);
};
