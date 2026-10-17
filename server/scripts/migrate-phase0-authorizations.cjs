const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const sourceFile = valueAfter('--source');
const blockedFile = valueAfter('--blocked-source');
const schema = valueAfter('--schema');
const apply = args.includes('--apply');

if (!sourceFile || !schema || !/^[a-z][a-z0-9_]*$/.test(schema)) {
  throw new Error('Use --source <arquivo> --schema <schema> e, para aplicar, --apply.');
}
if (!apply) throw new Error('Simulação encerrada. Acrescente --apply para executar a migração.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');

const normalizeCpf = (value) => String(value || '').replace(/\D/g, '');
const validateCpf = (value) => {
  const cpf = normalizeCpf(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length += 1) {
    const sum = cpf
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const expected = (sum * 10) % 11 === 10 ? 0 : (sum * 10) % 11;
    if (Number(cpf[length]) !== expected) return false;
  }
  return true;
};
const extractCpfs = (file) => {
  const content = readFileSync(file, 'utf8');
  return [
    ...new Set(
      content
        .split(/[^\d.-]+/)
        .map(normalizeCpf)
        .filter((cpf) => /^\d{11}$/.test(cpf)),
    ),
  ];
};

async function main() {
  const target = new URL(process.env.DATABASE_URL);
  target.searchParams.set('schema', schema);
  const targetUrl = target.toString();
  const migrations = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: targetUrl },
    encoding: 'utf8',
  });
  if (migrations.status !== 0) throw new Error(`Migração falhou: ${migrations.stderr}`);

  const authorizedCpfs = extractCpfs(sourceFile);
  if (authorizedCpfs.length < 1) throw new Error('Nenhum CPF válido encontrado na fonte.');
  const blockedCpfs = blockedFile ? extractCpfs(blockedFile) : [];
  const prisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  try {
    const before = {
      members: await prisma.member.count(),
      cadastros: await prisma.cadastro.count(),
    };
    const result = await prisma.$transaction(async (tx) => {
      const imported = await tx.member.createMany({
        data: authorizedCpfs.map((cpf) => ({
          cpf,
          status: 'BLOCKED',
          notes: validateCpf(cpf)
            ? 'IMPORTADO DA BASE OFICIAL NA FASE 0'
            : 'IMPORTADO DA BASE OFICIAL — VALIDAÇÃO DO CPF PENDENTE',
        })),
        skipDuplicates: true,
      });
      let blocked = 0;
      for (const cpf of blockedCpfs) {
        await tx.member.upsert({
          where: { cpf },
          create: { cpf, status: 'BLOCKED', notes: 'BLOQUEIO ADMINISTRATIVO MIGRADO' },
          update: {
            status: 'BLOCKED',
            notes: 'BLOQUEIO ADMINISTRATIVO MIGRADO',
            accessCodeHash: null,
            accessCodeExpiresAt: null,
            accessCodeUsedAt: null,
          },
        });
        blocked += 1;
      }
      return { imported: imported.count, blocked };
    });
    const after = {
      members: await prisma.member.count(),
      cadastros: await prisma.cadastro.count(),
    };
    if (after.cadastros !== before.cadastros) {
      throw new Error('A contagem de cadastros mudou durante a migração.');
    }
    console.log(
      JSON.stringify({
        schema,
        authorizedSourceCount: authorizedCpfs.length,
        invalidCheckDigits: authorizedCpfs.filter((cpf) => !validateCpf(cpf)).length,
        membersBefore: before.members,
        membersAfter: after.members,
        cadastrosPreserved: after.cadastros,
        imported: result.imported,
        blockedRulesMigrated: result.blocked,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
