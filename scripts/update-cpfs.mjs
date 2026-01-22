import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const readCsvCpfs = (path) => {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const dataLines = (lines[0] || '').toLowerCase() === 'cpf' ? lines.slice(1) : lines;

  return dataLines.map((line) => line.replace(/\D/g, '')).filter((cpf) => cpf.length === 11);
};

const writeCsvCpfs = (path, cpfs) => {
  const out = ['CPF', ...cpfs].join('\n') + '\n';
  writeFileSync(path, out, 'utf8');
};

const sourceCsv = 'public/ENVIAR.csv';
if (!existsSync(sourceCsv)) {
  console.error(`Arquivo não encontrado: ${sourceCsv}`);
  process.exit(1);
}

const raw = readCsvCpfs(sourceCsv);
const seen = new Set();
const unique = [];
const duplicates = new Map();

for (const cpf of raw) {
  if (seen.has(cpf)) {
    duplicates.set(cpf, (duplicates.get(cpf) || 1) + 1);
    continue;
  }
  seen.add(cpf);
  unique.push(cpf);
}

// Canonical CSVs
writeCsvCpfs('public/ENVIAR.csv', unique);
if (existsSync('docs/ENVIAR.csv')) writeCsvCpfs('docs/ENVIAR.csv', unique);

console.log('CPFs no CSV (linhas de dados):', raw.length);
console.log('CPFs únicos (deduplicado):', unique.length);
console.log('Duplicados removidos:', raw.length - unique.length);

if (duplicates.size) {
  const list = [...duplicates.entries()].sort((a, b) => b[1] - a[1]);
  console.log('CPFs duplicados encontrados (mantido só o primeiro):');
  for (const [cpf, count] of list) {
    console.log(`- ${cpf} x${count}`);
  }
}
