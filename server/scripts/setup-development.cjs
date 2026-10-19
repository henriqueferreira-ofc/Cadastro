// Cria uma área isolada para desenvolvimento. Nunca modifica nem apaga as tabelas públicas.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const current = dotenv.parse(fs.readFileSync(envPath));
const sourceUrl = new URL(current.DATABASE_URL);
sourceUrl.searchParams.set('schema', 'public');
const devUrl = new URL(sourceUrl);
devUrl.searchParams.set('schema', 'aafab_desenvolvimento');
const source = new PrismaClient({ datasources: { db: { url: sourceUrl.toString() } } });
const dev = new PrismaClient({ datasources: { db: { url: devUrl.toString() } } });
(async () => {
  const exists =
    await source.$queryRaw`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'aafab_desenvolvimento'`;
  if (!exists.length) await source.$executeRawUnsafe('CREATE SCHEMA "aafab_desenvolvimento"');
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: devUrl.toString() },
    stdio: 'pipe',
  });
  // Só copia a base no primeiro uso; nunca sobrescreve o trabalho já feito no ambiente local.
  if ((await dev.cadastro.count()) === 0) {
    await dev.$transaction([
      dev.$executeRawUnsafe(
        'INSERT INTO "aafab_desenvolvimento"."Cadastro" SELECT * FROM "public"."Cadastro" ON CONFLICT DO NOTHING',
      ),
      dev.$executeRawUnsafe(
        'INSERT INTO "aafab_desenvolvimento"."Member" (id, cpf, status, "unlockedAt", "unlockedBy", notes, "createdAt", "updatedAt") SELECT id, cpf, status::text::"aafab_desenvolvimento"."MemberStatus", "unlockedAt", "unlockedBy", notes, "createdAt", "updatedAt" FROM "public"."Member" ON CONFLICT DO NOTHING',
      ),
      dev.$executeRawUnsafe(
        `SELECT setval('aafab_desenvolvimento."Cadastro_id_seq"', COALESCE((SELECT MAX(id) FROM "aafab_desenvolvimento"."Cadastro"),1), EXISTS(SELECT 1 FROM "aafab_desenvolvimento"."Cadastro"))`,
      ),
      dev.$executeRawUnsafe(
        `SELECT setval('aafab_desenvolvimento."Member_id_seq"', COALESCE((SELECT MAX(id) FROM "aafab_desenvolvimento"."Member"),1), EXISTS(SELECT 1 FROM "aafab_desenvolvimento"."Member"))`,
      ),
    ]);
  }
  const backup = path.join(root, '.env.site-backup');
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(envPath, backup);
    fs.chmodSync(backup, 0o600);
  }
  current.DATABASE_URL = devUrl.toString();
  current.APP_ENV = 'development';
  fs.writeFileSync(
    envPath,
    Object.entries(current)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  console.log(
    'Ambiente de desenvolvimento preparado: ' +
      (await dev.cadastro.count()) +
      ' cadastros copiados. Dados públicos preservados.',
  );
})()
  .catch((error) => {
    console.error(
      'Falha ao preparar desenvolvimento:',
      error.code || error.name,
      error.meta?.code,
      error.meta?.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[conexão omitida]'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await source.$disconnect();
    await dev.$disconnect();
  });
