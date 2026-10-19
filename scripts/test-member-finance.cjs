const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aafab-member-finance-'));
try {
  const output = path.join(dir, 'finance.cjs');
  require('esbuild').buildSync({
    entryPoints: [path.resolve(__dirname, '../member_finance.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: output,
    logLevel: 'silent',
  });
  const { memberFinance } = require(output);
  const fees = [
    {
      id: 1,
      competence: '2026-01',
      status: 'PAGO',
      amountCents: 5000,
      payment: { amountCents: 5000 },
    },
    { id: 2, competence: '2026-02', status: 'VENCIDO', amountCents: 6000, payment: null },
    { id: 3, competence: '2026-03', status: 'EM_ANALISE', amountCents: 7000, payment: null },
    { id: 4, competence: '2026-04', status: 'ABERTO', amountCents: 8000, payment: null },
    {
      id: 5,
      competence: '2025-12',
      status: 'PAGO',
      amountCents: 4000,
      payment: { amountCents: 4000 },
    },
  ];
  const result = memberFinance(fees, '2026', 'TODOS');
  assert.deepEqual(
    result.categories.map((group) => group.total),
    [5000, 8000, 6000, 7000],
  );
  assert.equal(
    result.categories.reduce((sum, group) => sum + group.total, 0),
    26000,
  );
  assert.equal(result.fees.length, 4);
  for (const status of ['PAGO', 'ABERTO', 'VENCIDO', 'EM_ANALISE']) {
    const filtered = memberFinance(fees, '2026', status);
    assert.equal(filtered.fees.length, 1);
    assert.equal(filtered.fees[0].status, status);
    assert.deepEqual(
      filtered.categories,
      result.categories,
      'Filtrar a lista preserva os totais e meses dos cartões.',
    );
    assert.deepEqual(
      filtered.categories.find((group) => group.status === status).fees,
      filtered.fees,
    );
  }
  assert.deepEqual(
    memberFinance(fees, 'TODOS', 'PAGO').fees.map((fee) => fee.competence),
    ['2026-01', '2025-12'],
  );
  assert.equal(memberFinance(fees, '2025', 'ABERTO').fees.length, 0);
  assert(
    memberFinance([], 'TODOS', 'TODOS').categories.every(
      (group) => group.total === 0 && group.fees.length === 0,
    ),
  );

  const review = { ...fees[1], status: 'EM_ANALISE' };
  assert.equal(memberFinance([review], 'TODOS', 'PAGO').fees.length, 0);
  const approved = { ...review, status: 'PAGO', payment: { amountCents: review.amountCents } };
  assert.equal(memberFinance([approved], 'TODOS', 'EM_ANALISE').fees.length, 0);
  assert.equal(memberFinance([approved], 'TODOS', 'PAGO').categories[0].total, 6000);
  const proof = { id: 20, competence: '2026-05', amountCents: 4000, status: 'PENDING' };
  const standalone = memberFinance([], '2026', 'EM_ANALISE', [proof]);
  assert.deepEqual(
    standalone.categories.map((group) => group.total),
    [0, 0, 0, 4000],
  );
  assert.equal(standalone.fees.length, 0);
  assert.deepEqual(standalone.proofs, [proof]);
  assert.equal(memberFinance([], '2025', 'TODOS', [proof]).proofs.length, 0);
  assert.equal(memberFinance([], 'TODOS', 'PAGO', [proof]).proofs.length, 0);
  const rejected = { ...proof, status: 'REJECTED' };
  assert.equal(memberFinance([], 'TODOS', 'TODOS', [rejected]).proofs.length, 1);
  assert.equal(memberFinance([], 'TODOS', 'EM_ANALISE', [rejected]).categories[3].total, 0);
  console.log(
    'OK meses por situação, filtro anual, totais sem duplicidade e transição de análise para pago.',
  );
} finally {
  fs.rmSync(dir, { recursive: true });
}
