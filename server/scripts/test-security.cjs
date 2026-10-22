const { spawn, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const makeCpf = () => {
  const digits = Array.from({ length: 9 }, () => crypto.randomInt(0, 10));
  if (digits.every((digit) => digit === digits[0])) digits[8] = (digits[8] + 1) % 10;
  for (let length = 9; length <= 10; length += 1) {
    const sum = digits
      .slice(0, length)
      .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    digits.push(remainder === 10 ? 0 : remainder);
  }
  return digits.join('');
};

const { generateTotpSecret, totpNow } = require('../dist/utils/totp');
const totpSecret = generateTotpSecret();

const waitForHealth = async (origin) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${origin}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Servidor de teste não iniciou.');
};

const request = async (origin, route, init = {}) => {
  const response = await fetch(`${origin}${route}`, init);
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return { response, body };
};

async function main() {
  const baseUrl = process.env.DATABASE_URL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;
  assert(baseUrl, 'DATABASE_URL ausente no ambiente de teste.');
  assert(
    adminPassword && adminPassword.length >= 16,
    'ADMIN_PASSWORD de teste precisa ter 16 caracteres.',
  );
  assert(jwtSecret && jwtSecret.length >= 32, 'JWT_SECRET de teste precisa ter 32 caracteres.');

  const schema = `security_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const database = new URL(baseUrl);
  database.searchParams.set('schema', schema);
  const testDatabaseUrl = database.toString();
  const adminDb = new PrismaClient({ datasources: { db: { url: baseUrl } } });
  const port = 43000 + crypto.randomInt(0, 1000);
  const origin = `http://127.0.0.1:${port}`;
  let server;

  try {
    await adminDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
      encoding: 'utf8',
    });
    assert(migrate.status === 0, `Migração de teste falhou: ${migrate.stderr}`);

    server = spawn(process.execPath, ['dist/index.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PORT: String(port),
        DATABASE_URL: testDatabaseUrl,
        CORS_ORIGINS: 'https://aafab.com.br',
        ADMIN_TOTP_SECRET: totpSecret,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForHealth(origin);

    const health = await fetch(`${origin}/health`, { headers: { Origin: 'https://aafab.com.br' } });
    assert(
      health.headers.get('access-control-allow-origin') === 'https://aafab.com.br',
      'Origem oficial sem CORS.',
    );
    assert(
      health.headers.get('x-content-type-options') === 'nosniff',
      'Helmet não configurou cabeçalhos.',
    );
    const untrusted = await fetch(`${origin}/health`, {
      headers: { Origin: 'https://example.invalid' },
    });
    assert(!untrusted.headers.get('access-control-allow-origin'), 'Origem externa recebeu CORS.');

    const noAdmin = await request(origin, '/api/cadastro/admin/list');
    assert(noAdmin.response.status === 401, 'Lista administrativa ficou pública.');
    const localBypass = await request(origin, '/api/cadastro/admin/list', {
      headers: { Authorization: 'Bearer local_admin_access' },
    });
    assert(localBypass.response.status === 401, 'Atalho administrativo local ainda funciona.');

    const attempt = (body) =>
      request(origin, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const withoutCode = await attempt({ password: adminPassword });
    assert(
      withoutCode.response.status === 401 && withoutCode.body.requiresCode === true,
      'Login administrativo dispensou o segundo fator.',
    );
    assert(!withoutCode.body.token, 'Token emitido sem o segundo fator.');
    const wrongPassword = await attempt({ password: 'senha-errada-qualquer', code: '123456' });
    assert(
      wrongPassword.response.status === 401 && !wrongPassword.body.requiresCode,
      'Senha errada revelou a exigência do segundo fator.',
    );
    const wrongCode = await attempt({ password: adminPassword, code: '000000' });
    assert(wrongCode.response.status === 401, 'Código incorreto foi aceito.');
    const goodCode = totpNow(totpSecret);
    const login = await attempt({ password: adminPassword, code: goodCode });
    assert(login.response.ok && login.body.token, 'Login administrativo com 2FA falhou.');
    const replayedCode = await attempt({ password: adminPassword, code: goodCode });
    assert(replayedCode.response.status === 401, 'Código do autenticador foi reutilizado.');
    const adminHeaders = {
      Authorization: `Bearer ${login.body.token}`,
      'Content-Type': 'application/json',
    };

    const cpf = makeCpf();
    const imported = await request(origin, '/api/auth/admin/members/import', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ cpfs: [cpf] }),
    });
    assert(imported.response.ok && imported.body.imported === 1, 'Importação segura falhou.');

    const paymentGuidance = await request(origin, '/api/auth/registration-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf }),
    });
    assert(
      paymentGuidance.response.ok && paymentGuidance.body.status === 'PAYMENT_REQUIRED',
      'CPF pendente não recebeu orientação de pagamento.',
    );
    const unknownGuidance = await request(origin, '/api/auth/registration-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: makeCpf() }),
    });
    assert(
      unknownGuidance.response.ok && unknownGuidance.body.status === 'NOT_FOUND',
      'CPF fora da relação recebeu dados de pagamento.',
    );

    const unlock = await request(origin, '/api/auth/admin/members/unlock', {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ cpf, notes: 'teste de integração' }),
    });
    assert(
      unlock.response.ok && /^\d{8}$/.test(unlock.body.accessCode),
      'Código temporário não foi emitido.',
    );
    assert(!JSON.stringify(unlock.body).includes('accessCodeHash'), 'Hash do código vazou na API.');

    const readyGuidance = await request(origin, '/api/auth/registration-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf }),
    });
    assert(
      readyGuidance.response.ok && readyGuidance.body.status === 'CODE_READY',
      'Liberação não disponibilizou a etapa do código.',
    );

    const denied = await request(origin, '/api/auth/registration-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, accessCode: '00000000' }),
    });
    assert(
      denied.response.ok && denied.body.eligible === false,
      'Código incorreto revelou acesso.',
    );

    const access = await request(origin, '/api/auth/registration-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, accessCode: unlock.body.accessCode }),
    });
    assert(
      access.response.ok && access.body.registrationToken,
      'Código correto não abriu o cadastro.',
    );

    const legacyLookup = await request(origin, `/api/cadastro/consulta/${cpf}`);
    assert(legacyLookup.response.status === 410, 'Consulta pública de dados ainda está ativa.');
    const noToken = await request(origin, '/api/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf }),
    });
    assert(noToken.response.status === 401, 'Cadastro sem token foi aceito.');

    const registration = {
      cpf,
      nome: 'ASSOCIADO TESTE',
      estado: 'DF',
      turma_cesd: '2026/1',
      rg: '1234567',
      email: 'teste@example.com',
      telefone: '61999999999',
      endereco: 'ENDERECO DE TESTE',
      bairro: 'CENTRO',
      cidade: 'BRASILIA',
      cep: '70000000',
      certidao_obito: '',
    };
    const created = await request(origin, '/api/cadastro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access.body.registrationToken}`,
      },
      body: JSON.stringify(registration),
    });
    assert(created.response.status === 201, 'Cadastro autorizado não foi criado.');
    assert(
      Object.keys(created.body.data).sort().join(',') === 'cpf,id',
      'Resposta pública devolveu dados pessoais.',
    );
    const registeredGuidance = await request(origin, '/api/auth/registration-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf }),
    });
    assert(
      registeredGuidance.response.ok && registeredGuidance.body.status === 'ALREADY_REGISTERED',
      'Cadastro concluído não foi direcionado ao primeiro acesso.',
    );

    const replay = await request(origin, '/api/cadastro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access.body.registrationToken}`,
      },
      body: JSON.stringify({ ...registration, nome: 'ALTERACAO INDEVIDA' }),
    });
    assert(
      [401, 409].includes(replay.response.status),
      'Token foi reutilizado para alterar cadastro.',
    );

    const reuseCode = await request(origin, '/api/auth/registration-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, accessCode: unlock.body.accessCode }),
    });
    assert(
      reuseCode.response.ok && reuseCode.body.eligible === false,
      'Código temporário foi reutilizado.',
    );

    // Cabeçalhos de segurança da API e encerramento de sessão no servidor
    const apiHeaders = await fetch(`${origin}/api/auth/login`, { method: 'OPTIONS' });
    assert(
      apiHeaders.headers.get('cache-control') === 'no-store',
      'API sem Cache-Control: no-store.',
    );
    const csp = apiHeaders.headers.get('content-security-policy') || '';
    assert(
      csp.includes("default-src 'none'") && csp.includes("frame-ancestors 'none'"),
      'CSP da API ausente.',
    );
    assert(apiHeaders.headers.get('permissions-policy'), 'Permissions-Policy ausente.');
    assert(apiHeaders.headers.get('referrer-policy') === 'no-referrer', 'Referrer-Policy ausente.');
    const listBefore = await request(origin, '/api/cadastro/admin/list', { headers: adminHeaders });
    assert(listBefore.response.status === 200, 'Sessão administrativa válida foi recusada.');
    const logout = await request(origin, '/api/auth/logout', {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(logout.response.ok, 'Logout administrativo falhou.');
    const listAfter = await request(origin, '/api/cadastro/admin/list', { headers: adminHeaders });
    assert(listAfter.response.status === 401, 'Token continuou válido após o logout.');

    console.log(
      'Segurança integrada: fluxo cadastral, segundo fator e controles de acesso aprovados.',
    );
  } finally {
    if (server) {
      server.kill('SIGTERM');
      await new Promise((resolve) => server.once('exit', resolve));
    }
    await adminDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminDb.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
