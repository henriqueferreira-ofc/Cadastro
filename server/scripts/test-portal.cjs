// Integração do Portal do Associado em schema temporário e isolado.
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
const schema = `aafab_portal_test_${crypto.randomBytes(6).toString('hex')}`;
const url = new URL(config.DATABASE_URL);
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
const adminPassword = crypto.randomBytes(20).toString('hex');
let processHandle;
let base;
let adminToken;
let memberToken;
let passed = 0;
let requestId;

async function call(route, body, token) {
  return fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
}

async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`OK ${name}`);
}

const cadastroData = (cpf, suffix) => ({
  cpf,
  nome: `ASSOCIADO FICTÍCIO ${suffix}`,
  estado: 'DF',
  turma_cesd: 'TESTE',
  rg: `RG-${suffix}`,
  email: `${suffix.toLowerCase()}@example.invalid`,
  telefone: '61999999999',
  endereco: `ENDEREÇO ${suffix}`,
  bairro: 'CENTRO',
  cidade: 'BRASÍLIA',
  cep: '70000000',
});

(async () => {
  assert.match(schema, /^aafab_portal_test_[a-f0-9]{12}$/);
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  });

  const [first, second] = await Promise.all([
    db.cadastro.create({ data: cadastroData('52998224725', 'UM') }),
    db.cadastro.create({ data: cadastroData('11144477735', 'DOIS') }),
    db.member.create({ data: { cpf: '52998224725', status: 'ACTIVE' } }),
    db.member.create({ data: { cpf: '11144477735', status: 'ACTIVE' } }),
  ]).then((items) => [items[0], items[1]]);

  await Promise.all([
    db.monthlyFee.create({
      data: {
        cadastroId: first.id,
        competence: '2026-09',
        amountCents: 5000,
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
        notes: 'Mensalidade fictícia',
      },
    }),
    db.monthlyFee.create({
      data: {
        cadastroId: second.id,
        competence: '2026-08',
        amountCents: 9900,
        dueDate: new Date('2026-08-10T00:00:00.000Z'),
        notes: 'Registro que não pode vazar',
      },
    }),
    db.officeEntry.create({
      data: {
        cadastroId: first.id,
        kind: 'ATENDIMENTO',
        title: 'Atendimento do primeiro associado',
        description: 'Visível somente ao titular.',
        visibleToMember: true,
      },
    }),
    db.officeEntry.create({
      data: {
        cadastroId: second.id,
        kind: 'PENDENCIA',
        title: 'Registro reservado do segundo associado',
        description: 'Não pode aparecer para o primeiro.',
        visibleToMember: true,
      },
    }),
    db.officeEntry.create({
      data: {
        cadastroId: first.id,
        kind: 'PENDENCIA',
        title: 'Registro interno da Secretaria',
        description: 'Este texto não pode ser enviado ao portal.',
      },
    }),
    db.associationPost.create({
      data: {
        title: 'Comunicado publicado',
        summary: 'Resumo público aos associados',
        content: 'Conteúdo fictício de teste.',
        status: 'PUBLICADO',
        publishedAt: new Date(),
      },
    }),
    db.associationPost.create({
      data: {
        title: 'Rascunho reservado',
        summary: 'Não deve ser exibido',
        content: 'Conteúdo interno.',
        status: 'RASCUNHO',
      },
    }),
  ]);

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

  const adminLogin = await call('/auth/login', { password: adminPassword });
  assert.equal(adminLogin.status, 200);
  adminToken = (await adminLogin.json()).token;

  await check('portal exige sessão própria do associado', async () => {
    assert.equal((await call('/member/overview')).status, 401);
    assert.equal((await call('/member/overview', undefined, adminToken)).status, 401);
    assert.equal(
      (await call('/member/login', { cpf: first.cpf, password: 'SenhaAindaNaoCriada1' })).status,
      401,
    );
  });

  let activationCode;
  await check('admin emite código de ativação apenas para cadastro existente', async () => {
    const response = await call(
      '/auth/admin/members/portal-access',
      { cpf: first.cpf },
      adminToken,
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.match(data.accessCode, /^\d{8}$/);
    activationCode = data.accessCode;
    const account = await db.memberAccount.findUnique({ where: { cadastroId: first.id } });
    assert(account.activationCodeHash);
    assert(!JSON.stringify(data).includes(account.activationCodeHash));
  });

  await check('código incorreto não ativa a conta', async () => {
    const response = await call('/member/activate', {
      cpf: first.cpf,
      code: activationCode === '00000000' ? '11111111' : '00000000',
      password: 'SenhaSegura123',
    });
    assert.equal(response.status, 400);
  });

  await check('ativação cria senha, sessão e invalida o código', async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        call('/member/activate', {
          cpf: first.cpf,
          code: activationCode,
          password: 'SenhaSegura123',
        }),
      ),
    );
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
    const response = responses.find((item) => item.status === 200);
    const data = await response.json();
    assert(data.token);
    memberToken = data.token;
    const account = await db.memberAccount.findUnique({ where: { cadastroId: first.id } });
    assert(account.passwordHash.startsWith('scrypt$'));
    assert.equal(account.activationCodeHash, null);
    assert(account.activationCodeUsedAt);
  });

  await check('visão do portal contém somente dados próprios e conteúdo publicado', async () => {
    const response = await call('/member/overview', undefined, memberToken);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.profile.id, first.id);
    assert.equal(data.finance.fees.length, 1);
    assert.equal(data.finance.fees[0].amountCents, 5000);
    assert.equal(data.secretary.entries.length, 1);
    assert.equal(data.secretary.entries[0].title, 'Atendimento do primeiro associado');
    assert.deepEqual(
      data.posts.map((post) => post.title),
      ['Comunicado publicado'],
    );
    assert(!JSON.stringify(data).includes('Registro reservado do segundo associado'));
    assert(!JSON.stringify(data).includes('Registro interno da Secretaria'));
    assert(!JSON.stringify(data).includes('Rascunho reservado'));
  });

  await check('solicitação sempre fica vinculada ao titular autenticado', async () => {
    const response = await call(
      '/member/secretaria/requests',
      {
        cadastroId: second.id,
        title: 'Pedido do titular',
        description: 'Solicitação criada pelo portal.',
      },
      memberToken,
    );
    assert.equal(response.status, 201);
    requestId = (await response.json()).id;
    const entry = await db.officeEntry.findUnique({ where: { id: requestId } });
    assert.equal(entry.cadastroId, first.id);
  });

  await check('Secretaria mantém conversa privada entre associado e administração', async () => {
    const answered = await call(
      `/gestao/secretaria/registros/${requestId}/respostas`,
      { content: 'Resposta reservada da Secretaria.', status: 'EM_ANDAMENTO' },
      adminToken,
    );
    assert.equal(answered.status, 200);
    const reply = await call(
      `/member/secretaria/requests/${requestId}/messages`,
      { content: 'Retorno reservado do associado.' },
      memberToken,
    );
    assert.equal(reply.status, 200);
    const secondEntry = await db.officeEntry.findFirst({ where: { cadastroId: second.id } });
    assert.equal(
      (
        await call(
          `/member/secretaria/requests/${secondEntry.id}/messages`,
          { content: 'Tentativa de acesso indevido.' },
          memberToken,
        )
      ).status,
      404,
    );
    const overview = await call('/member/overview', undefined, memberToken);
    const data = await overview.json();
    const conversation = data.secretary.entries.find((item) => item.id === requestId);
    assert.deepEqual(
      conversation.messages.map((item) => item.sender),
      ['MEMBER', 'ADMIN', 'MEMBER'],
    );
    assert(!JSON.stringify(data).includes('Tentativa de acesso indevido.'));
  });

  await check('anexos publicados são protegidos e rascunhos permanecem internos', async () => {
    const [published, draft] = await Promise.all([
      db.associationPost.findFirst({ where: { status: 'PUBLICADO' } }),
      db.associationPost.findFirst({ where: { status: 'RASCUNHO' } }),
    ]);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
    const publishedUpload = await call(
      `/gestao/comunicados/${published.id}/anexos`,
      {
        title: 'Resultado publicado',
        fileName: 'resultado.png',
        mimeType: 'image/png',
        content: png,
      },
      adminToken,
    );
    assert.equal(publishedUpload.status, 201);
    const publishedAttachment = await publishedUpload.json();
    const draftUpload = await call(
      `/gestao/comunicados/${draft.id}/anexos`,
      { title: 'Arquivo interno', fileName: 'interno.png', mimeType: 'image/png', content: png },
      adminToken,
    );
    assert.equal(draftUpload.status, 201);
    const draftAttachment = await draftUpload.json();
    assert.equal(
      (
        await call(
          `/member/comunicados/anexos/${publishedAttachment.id}/arquivo`,
          undefined,
          memberToken,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `/member/comunicados/anexos/${draftAttachment.id}/arquivo`,
          undefined,
          memberToken,
        )
      ).status,
      404,
    );
  });

  await check(
    'bloqueio financeiro usa o schema configurado mesmo com search_path de outra sessão',
    async () => {
      const { lockMonthlyFee } = require('../dist/domain/finance');
      const previousUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = url.toString();
      try {
        const fee = await db.monthlyFee.findFirst({ where: { cadastroId: first.id } });
        await db.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL search_path = pg_catalog');
          await lockMonthlyFee(tx, fee.id);
        });
      } finally {
        if (previousUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previousUrl;
      }
    },
  );

  await check('comprovante fica em análise e somente a aprovação registra pagamento', async () => {
    const fee = await db.monthlyFee.findUnique({
      where: { cadastroId_competence: { cadastroId: first.id, competence: '2026-09' } },
    });
    const otherFee = await db.monthlyFee.findUnique({
      where: { cadastroId_competence: { cadastroId: second.id, competence: '2026-08' } },
    });
    const pixResponse = await call(`/member/finance/fees/${fee.id}/pix`, undefined, memberToken);
    assert.equal(pixResponse.status, 200);
    const pix = await pixResponse.json();
    assert.equal(pix.amountCents, 5000);
    assert.match(pix.payload, /^000201/);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
    const body = {
      feeId: fee.id,
      fileName: 'comprovante.png',
      mimeType: 'image/png',
      content: png,
    };
    const uploads = await Promise.all([
      call('/member/finance/proofs', body, memberToken),
      call('/member/finance/proofs', body, memberToken),
    ]);
    assert.deepEqual(uploads.map((response) => response.status).sort(), [201, 409]);
    const upload = uploads.find((response) => response.status === 201);
    const proof = await upload.json();
    const conflict = await uploads.find((response) => response.status === 409).json();
    assert(!JSON.stringify(conflict).includes('prisma'));
    assert.equal((await call('/member/finance/proofs', body, memberToken)).status, 409);
    assert.equal(
      (await call('/member/finance/proofs', { ...body, feeId: otherFee.id }, memberToken)).status,
      404,
    );
    let overview = await call('/member/overview', undefined, memberToken);
    let data = await overview.json();
    assert.equal(data.finance.fees[0].status, 'EM_ANALISE');
    assert.equal(data.finance.fees[0].payment, null);
    assert.equal(
      (
        await call(
          `/gestao/mensalidades/${fee.id}/pagamento`,
          { paidAt: '2026-10-17', method: 'PIX' },
          adminToken,
        )
      ).status,
      409,
    );
    const approvals = await Promise.all(
      [1, 2].map(() =>
        call(`/gestao/comprovantes/${proof.id}/aprovar`, { paidAt: '2026-10-17' }, adminToken),
      ),
    );
    assert.deepEqual(approvals.map((response) => response.status).sort(), [200, 409]);
    assert.equal(
      (await call(`/gestao/comprovantes/${proof.id}/aprovar`, { paidAt: '2026-10-17' }, adminToken))
        .status,
      409,
    );
    overview = await call('/member/overview', undefined, memberToken);
    data = await overview.json();
    assert.equal(data.finance.fees[0].status, 'PAGO');
    assert.equal(data.finance.fees[0].payment.amountCents, 5000);
    assert.equal(await db.feePayment.count({ where: { feeId: fee.id } }), 1);
    assert.equal((await call('/member/finance/proofs', body, memberToken)).status, 409);
  });

  await check('identificadores e arquivos inválidos retornam erros públicos seguros', async () => {
    for (const route of [
      '/member/finance/proofs/abc/file',
      '/member/comunicados/anexos/abc/arquivo',
    ]) {
      const response = await call(route, undefined, memberToken);
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: 'Identificador inválido.' });
    }
    const response = await call(
      '/member/finance/proofs',
      {
        feeId: 1,
        fileName: 'falso.png',
        mimeType: 'image/png',
        content: Buffer.from('arquivo inválido').toString('base64'),
      },
      memberToken,
    );
    assert.equal(response.status, 400);
    assert(!JSON.stringify(await response.json()).includes('prisma'));
  });

  await check('recusa informa o motivo e permite novo comprovante sem dar baixa', async () => {
    const fee = await db.monthlyFee.create({
      data: {
        cadastroId: first.id,
        competence: '2026-10',
        amountCents: 5500,
        dueDate: new Date('2026-10-10T00:00:00.000Z'),
      },
    });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64');
    const body = {
      feeId: fee.id,
      fileName: 'comprovante.png',
      mimeType: 'image/png',
      content: png,
    };
    const firstUpload = await call('/member/finance/proofs', body, memberToken);
    const proof = await firstUpload.json();
    assert.equal(firstUpload.status, 201);
    assert.equal(
      (
        await call(
          `/gestao/comprovantes/${proof.id}/recusar`,
          { reason: 'Arquivo ilegível.' },
          adminToken,
        )
      ).status,
      200,
    );
    const storedFee = await db.monthlyFee.findUnique({
      where: { id: fee.id },
      include: { payment: true },
    });
    assert.equal(storedFee.payment, null);
    const overview = await call('/member/overview', undefined, memberToken);
    const data = await overview.json();
    const shown = data.finance.fees.find((item) => item.id === fee.id);
    assert.equal(shown.proof.status, 'REJECTED');
    assert.equal(shown.proof.rejectionReason, 'Arquivo ilegível.');
    assert.equal((await call('/member/finance/proofs', body, memberToken)).status, 201);
  });

  const directProof = (competence) => ({
    competence,
    fileName: 'pagamento.png',
    mimeType: 'image/png',
    content: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64'),
  });

  await check(
    'envio sem lançamento fica em análise e aprovação cria um único pagamento',
    async () => {
      const body = { ...directProof('2026-01'), cadastroId: second.id, amountCents: 1 };
      const responses = await Promise.all([
        call('/member/finance/proofs', body, memberToken),
        call('/member/finance/proofs', body, memberToken),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
      const proof = await responses.find((response) => response.status === 201).json();
      const stored = await db.paymentProof.findUnique({ where: { id: proof.id } });
      assert.equal(stored.feeId, null);
      assert.equal(stored.cadastroId, first.id);
      assert.equal(stored.amountCents, 4000);
      assert.equal(
        await db.monthlyFee.count({ where: { cadastroId: first.id, competence: body.competence } }),
        0,
      );
      let data = await (await call('/member/overview', undefined, memberToken)).json();
      assert.equal(
        data.finance.standaloneProofs.find((item) => item.id === proof.id).status,
        'PENDING',
      );
      const inbox = await (await call('/gestao/comprovantes', undefined, adminToken)).json();
      const shown = inbox.find((item) => item.id === proof.id);
      assert.equal(shown.fee, null);
      assert.equal(shown.cadastro.id, first.id);
      assert.equal(shown.competence, '2026-01');
      const file = await call(`/member/finance/proofs/${proof.id}/file`, undefined, memberToken);
      assert.equal(file.status, 200);
      assert.deepEqual(Buffer.from(await file.arrayBuffer()), Buffer.from(body.content, 'base64'));
      const other = await db.paymentProof.create({
        data: {
          cadastroId: second.id,
          competence: '2026-01',
          amountCents: 4000,
          fileName: body.fileName,
          mimeType: body.mimeType,
          content: Buffer.from(body.content, 'base64'),
          size: 12,
          contentHash: 'test',
        },
      });
      assert.equal(
        (await call(`/member/finance/proofs/${other.id}/file`, undefined, memberToken)).status,
        404,
      );
      data = await (await call('/member/overview', undefined, memberToken)).json();
      assert(!data.finance.standaloneProofs.some((item) => item.id === other.id));
      assert.equal(
        (
          await call(
            `/gestao/comprovantes/${proof.id}/aprovar`,
            { paidAt: '2026-01-12' },
            adminToken,
          )
        ).status,
        400,
      );
      assert.equal(
        await db.monthlyFee.count({ where: { cadastroId: first.id, competence: body.competence } }),
        0,
      );
      const approvals = await Promise.all(
        [1, 2].map(() =>
          call(
            `/gestao/comprovantes/${proof.id}/aprovar`,
            { paidAt: '2026-01-12', dueDate: '2026-01-10' },
            adminToken,
          ),
        ),
      );
      assert.deepEqual(approvals.map((response) => response.status).sort(), [200, 409]);
      data = await (await call('/member/overview', undefined, memberToken)).json();
      assert(!data.finance.standaloneProofs.some((item) => item.id === proof.id));
      const fee = data.finance.fees.find((item) => item.competence === body.competence);
      assert.equal(fee.status, 'PAGO');
      assert.equal(fee.payment.amountCents, 4000);
      assert.equal(await db.feePayment.count({ where: { feeId: fee.id } }), 1);
      assert.equal((await call('/member/finance/proofs', body, memberToken)).status, 409);
    },
  );

  await check(
    'recusa sem lançamento permite reenvio e lançamento posterior vincula a análise',
    async () => {
      const body = directProof('2026-02');
      let response = await call('/member/finance/proofs', body, memberToken);
      assert.equal(response.status, 201);
      const rejected = await response.json();
      assert.equal(
        (
          await call(
            `/gestao/comprovantes/${rejected.id}/recusar`,
            { reason: 'Arquivo ilegível.' },
            adminToken,
          )
        ).status,
        200,
      );
      const data = await (await call('/member/overview', undefined, memberToken)).json();
      assert.equal(
        data.finance.standaloneProofs.find((item) => item.id === rejected.id).rejectionReason,
        'Arquivo ilegível.',
      );
      assert.equal(
        await db.monthlyFee.count({ where: { cadastroId: first.id, competence: body.competence } }),
        0,
      );
      response = await call('/member/finance/proofs', body, memberToken);
      assert.equal(response.status, 201);
      const pending = await response.json();
      const feeBody = {
        cadastroId: first.id,
        competence: body.competence,
        amountCents: 4000,
        dueDate: '2026-02-10',
      };
      assert.equal(
        (await call('/gestao/mensalidades', { ...feeBody, amountCents: 5000 }, adminToken)).status,
        409,
      );
      response = await call('/gestao/mensalidades', feeBody, adminToken);
      assert.equal(response.status, 201);
      const fee = await response.json();
      assert.equal((await db.paymentProof.findUnique({ where: { id: pending.id } })).feeId, fee.id);
      assert.equal(
        (
          await call(
            `/gestao/mensalidades/${fee.id}/pagamento`,
            { paidAt: '2026-02-12', method: 'PIX' },
            adminToken,
          )
        ).status,
        409,
      );
      assert.equal(
        (
          await call(
            `/gestao/comprovantes/${pending.id}/aprovar`,
            { paidAt: '2026-02-12' },
            adminToken,
          )
        ).status,
        200,
      );
    },
  );

  await check(
    'envio por mês respeita valor cadastrado e rejeita mês e arquivo inválidos',
    async () => {
      await db.monthlyFee.create({
        data: {
          cadastroId: first.id,
          competence: '2026-03',
          amountCents: 6200,
          dueDate: new Date('2026-03-10'),
        },
      });
      const response = await call(
        '/member/finance/proofs',
        { ...directProof('2026-03'), amountCents: 1 },
        memberToken,
      );
      assert.equal(response.status, 201);
      const proof = await response.json();
      assert.equal(
        (await db.paymentProof.findUnique({ where: { id: proof.id } })).amountCents,
        6200,
      );
      for (const patch of [
        { competence: '2026-13' },
        { competence: '' },
        { content: 'bm90LWEtcG5n' },
      ]) {
        assert.equal(
          (
            await call(
              '/member/finance/proofs',
              { ...directProof('2026-04'), ...patch },
              memberToken,
            )
          ).status,
          400,
        );
      }
    },
  );

  await check('token do associado não abre rotas administrativas', async () => {
    assert.equal((await call('/gestao/associados', undefined, memberToken)).status, 401);
    assert.equal((await call('/cadastro/admin/list', undefined, memberToken)).status, 401);
  });

  await check('redefinição troca a senha e revoga a sessão anterior', async () => {
    const issued = await call('/auth/admin/members/portal-access', { cpf: first.cpf }, adminToken);
    assert.equal(issued.status, 200);
    const reset = await issued.json();
    assert.equal(reset.purpose, 'PASSWORD_RESET');
    const activated = await call('/member/activate', {
      cpf: first.cpf,
      code: reset.accessCode,
      password: 'NovaSenhaSegura456',
    });
    assert.equal(activated.status, 200);
    const oldSession = await call('/member/overview', undefined, memberToken);
    assert.equal(oldSession.status, 401);
    memberToken = (await activated.json()).token;
  });

  await check('login, logout e bloqueio revogam sessões com segurança', async () => {
    const denied = await call('/member/login', { cpf: first.cpf, password: 'SenhaErrada123' });
    assert.equal(denied.status, 401);
    assert.equal((await denied.json()).error, 'CPF ou senha inválidos.');
    const accepted = await call('/member/login', {
      cpf: first.cpf,
      password: 'NovaSenhaSegura456',
    });
    assert.equal(accepted.status, 200);
    const loginToken = (await accepted.json()).token;
    assert(loginToken);
    assert.equal((await call('/member/logout', {}, loginToken)).status, 200);
    assert.equal((await call('/member/overview', undefined, loginToken)).status, 401);

    const signedInAgain = await call('/member/login', {
      cpf: first.cpf,
      password: 'NovaSenhaSegura456',
    });
    const activeToken = (await signedInAgain.json()).token;
    assert(activeToken);
    assert.equal(
      (await call('/auth/admin/members/block', { cpf: first.cpf }, adminToken)).status,
      200,
    );
    assert.equal((await call('/member/overview', undefined, activeToken)).status, 401);
  });

  console.log(`${passed} cenários do Portal do Associado passaram.`);
})()
  .catch((error) => {
    console.error(
      'TESTE FALHOU:',
      String(error.message || error).replace(/postgres(?:ql)?:\/\/\S+/g, '[conexão omitida]'),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (processHandle && processHandle.exitCode === null) {
      processHandle.kill('SIGTERM');
      await once(processHandle, 'exit').catch(() => {});
    }
    if (/^aafab_portal_test_[a-f0-9]{12}$/.test(schema)) {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => {});
    }
    await db.$disconnect();
  });
