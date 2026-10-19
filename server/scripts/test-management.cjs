// Integração real em um schema temporário. Nunca testa gravações no schema público.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '..');
const config = {
  ...(fs.existsSync(path.join(root, '.env'))
    ? dotenv.parse(fs.readFileSync(path.join(root, '.env')))
    : {}),
  ...process.env,
};
const schema = `aafab_test_${crypto.randomBytes(6).toString('hex')}`;
const url = new URL(config.DATABASE_URL);
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const adminPassword = crypto.randomBytes(20).toString('hex');
let processHandle;
let token;
let base;
let passed = 0;
async function call(route, body, auth = true) {
  return fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
}
async function check(name, test) {
  await test();
  passed++;
  console.log(`OK ${name}`);
}
(async () => {
  // Nome de schema exclusivamente gerado pelo teste, não derivado de entrada externa.
  assert.match(schema, /^aafab_test_[a-f0-9]{12}$/);
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });
  const associate = await db.cadastro.create({
    data: {
      cpf: '52998224725',
      nome: 'ASSOCIADO FICTÍCIO DE TESTE',
      estado: 'DF',
      turma_cesd: 'TESTE',
      rg: 'TESTE',
      email: 'fixture@example.invalid',
      telefone: '00000000000',
      endereco: 'TESTE',
      bairro: 'TESTE',
      cidade: 'TESTE',
      cep: '00000000',
    },
  });
  processHandle = spawn(process.execPath, ['dist/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: '0',
      DATABASE_URL: url.toString(),
      ADMIN_PASSWORD: adminPassword,
      JWT_SECRET: crypto.randomBytes(40).toString('hex'),
      NODE_ENV: 'production',
      APP_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // O servidor de teste usa uma porta efêmera, anunciada no log após listen.
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Servidor de teste não iniciou')), 20000);
    processHandle.stdout.on('data', (chunk) => {
      const match = String(chunk).match(/porta (\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(`http://127.0.0.1:${match[1]}/api`);
      }
    });
    processHandle.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Servidor encerrou: ${code}`));
    });
  });
  const login = await call('/auth/login', { password: adminPassword }, false);
  assert.equal(login.status, 200);
  token = (await login.json()).token;
  await check('rotas protegidas exigem autenticação', async () => {
    for (const route of [
      '/gestao/associados',
      '/gestao/mensalidades',
      `/gestao/secretaria/${associate.id}`,
      '/gestao/documentos/1/arquivo',
    ])
      assert.equal((await call(route, undefined, false)).status, 401);
    const bypass = await fetch(base + '/gestao/associados', {
      headers: { Authorization: 'Bearer local_admin_access' },
    });
    assert.equal(bypass.status, 401);
  });
  let entryId;
  await check('cria solicitação e mantém histórico após conclusão', async () => {
    const created = await call('/gestao/secretaria', {
      cadastroId: associate.id,
      kind: 'SOLICITACAO',
      title: 'Declaração de vínculo',
      description: 'Registro fictício',
      dueDate: '2026-12-10',
    });
    assert.equal(created.status, 201);
    const createdEntry = await created.json();
    entryId = createdEntry.id;
    assert.equal(createdEntry.visibleToMember, false);
    const visible = await call(`/gestao/secretaria/registros/${entryId}/visibilidade`, {
      visibleToMember: true,
    });
    assert.equal(visible.status, 200);
    assert.equal((await visible.json()).visibleToMember, true);
    const updated = await call(`/gestao/secretaria/registros/${entryId}/historico`, {
      status: 'CONCLUIDO',
      note: 'Documento entregue no teste.',
    });
    assert.equal(updated.status, 200);
    const data = await (await call(`/gestao/secretaria/${associate.id}`)).json();
    assert.equal(data.entries[0].events.length, 2);
    assert.equal(data.entries[0].description, 'Registro fictício');
    assert.equal(data.entries[0].status, 'CONCLUIDO');
  });
  await check('observações e validações da Secretaria', async () => {
    const created = await call('/gestao/secretaria', {
      cadastroId: associate.id,
      kind: 'OBSERVACAO',
      title: 'Nota',
      description: 'Observação preservada',
    });
    assert.equal(created.status, 201);
    const entry = await created.json();
    assert.equal(entry.status, 'CONCLUIDO');
    assert.equal(
      (
        await call(`/gestao/secretaria/registros/${entry.id}/visibilidade`, {
          visibleToMember: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(`/gestao/secretaria/registros/${entry.id}/historico`, {
          status: 'ABERTO',
          note: 'Inválido',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/gestao/secretaria', {
          cadastroId: associate.id,
          kind: 'INVALIDO',
          title: 'x',
          description: 'y',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/gestao/secretaria', {
          cadastroId: associate.id,
          kind: 'PENDENCIA',
          title: ' ',
          description: 'y',
        })
      ).status,
      400,
    );
  });
  await check('anexo protegido mantém bytes e rejeita formato falso', async () => {
    const content = Buffer.from('%PDF-1.4\nDocumento fictício para teste\n%%EOF');
    const uploaded = await call('/gestao/documentos', {
      cadastroId: associate.id,
      title: 'Documento fictício',
      fileName: 'teste.pdf',
      mimeType: 'application/pdf',
      content: content.toString('base64'),
    });
    assert.equal(uploaded.status, 201);
    const doc = await uploaded.json();
    assert.equal(doc.content, undefined);
    const downloaded = await call(`/gestao/documentos/${doc.id}/arquivo`);
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get('content-disposition'), /^attachment/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), content);
    assert.equal(
      (
        await call('/gestao/documentos', {
          cadastroId: associate.id,
          title: 'Inválido',
          fileName: 'falso.pdf',
          mimeType: 'application/pdf',
          content: Buffer.from('<script>bad</script>').toString('base64'),
        })
      ).status,
      400,
    );
  });
  const feeBody = {
    cadastroId: associate.id,
    competence: '2026-10',
    amountCents: 5099,
    dueDate: '2026-10-05',
    notes: 'Teste isolado',
  };
  let feeId;
  await check('cria mensalidade com centavos e bloqueia duplicação', async () => {
    const response = await call('/gestao/mensalidades', feeBody);
    assert.equal(response.status, 201);
    const fee = await response.json();
    feeId = fee.id;
    assert.equal(fee.amountCents, 5099);
    assert.equal(fee.payment, null);
    assert.equal((await call('/gestao/mensalidades', feeBody)).status, 409);
  });
  await check('valida valor, mês, data e associado no servidor', async () => {
    for (const patch of [
      { amountCents: 0 },
      { amountCents: -1 },
      { amountCents: 1.5 },
      { amountCents: 100000001 },
      { competence: '2026-13' },
      { dueDate: '2026-02-30' },
      { cadastroId: 999999 },
    ])
      assert.equal((await call('/gestao/mensalidades', { ...feeBody, ...patch })).status, 400);
    assert.equal((await call('/gestao/mensalidades?competence=2026-00')).status, 400);
  });
  await check('pagamento futuro e forma inválida rejeitados', async () => {
    assert.equal(
      (
        await call(`/gestao/mensalidades/${feeId}/pagamento`, {
          paidAt: '2099-01-01',
          method: 'PIX',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(`/gestao/mensalidades/${feeId}/pagamento`, {
          paidAt: '2026-01-01',
          method: 'INVALIDO',
        })
      ).status,
      400,
    );
  });
  await check('requisições simultâneas não duplicam pagamento', async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        call(`/gestao/mensalidades/${feeId}/pagamento`, {
          paidAt: '2026-01-01',
          method: 'PIX',
          reference: 'teste-concorrencia',
        }),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await db.feePayment.count(), 1);
    const fee = await db.monthlyFee.findUnique({
      where: { id: feeId },
      include: { payment: true },
    });
    assert.equal(fee.payment.amountCents, 5099);
  });
  await check('filtro mensal e persistência após nova consulta', async () => {
    assert.equal(
      (
        await call('/gestao/mensalidades', {
          ...feeBody,
          competence: '2026-11',
          dueDate: '2026-11-05',
        })
      ).status,
      201,
    );
    const all = await (await call('/gestao/mensalidades')).json();
    assert.equal(all.length, 2);
    const october = await (await call('/gestao/mensalidades?competence=2026-10')).json();
    assert.equal(october.length, 1);
    assert.equal(october[0].payment.amountCents, 5099);
    assert.equal(await db.member.count(), 0); // baixa não libera CPF automaticamente
  });
  console.log(`${passed} cenários de integração passaram.`);
})()
  .catch((error) => {
    console.error(
      'TESTE FALHOU:',
      error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[conexão omitida]'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (processHandle && processHandle.exitCode === null) {
      processHandle.kill('SIGTERM');
      await once(processHandle, 'exit').catch(() => {});
    }
    if (/^aafab_test_[a-f0-9]{12}$/.test(schema))
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    await db.$disconnect();
  });
