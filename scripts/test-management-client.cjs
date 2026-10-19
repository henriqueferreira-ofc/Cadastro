const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aafab-management-'));
try {
  const output = path.join(dir, 'management.cjs');
  require('esbuild').buildSync({
    entryPoints: [path.resolve(__dirname, '../management_service.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: output,
    logLevel: 'silent',
  });
  const { parseMoney, matchesAssociate, feeStatus, shortDate, csvCell } = require(output);
  assert.equal(parseMoney('50,99'), 5099);
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('0,01'), 1);
  for (const value of ['0', '-5', '1,234', '1.23', 'abc', '1000001'])
    assert.throws(() => parseMoney(value));
  assert(matchesAssociate({ nome: 'JOSÉ ÁLVARES', cpf: '52998224725' }, 'jose alvares'));
  assert(matchesAssociate({ nome: 'TESTE', cpf: '52998224725' }, '529.982'));
  assert.equal(feeStatus({ payment: null, dueDate: '2020-01-01' }), 'VENCIDO');
  assert.equal(feeStatus({ payment: {}, dueDate: '2020-01-01' }), 'PAGO');
  assert.equal(feeStatus({ payment: null, dueDate: '2099-12-31' }), 'ABERTO');
  assert.equal(shortDate('2026-10-16T00:00:00.000Z'), '16/10/2026');
  assert.equal(csvCell('Nome; "Teste"'), '"Nome; ""Teste"""');
  assert.equal(csvCell('50,99'), '"50,99"');
  assert.equal(csvCell(null), '""');
  for (const value of [
    '=1+1',
    '+1+1',
    '-1+1',
    '@SUM(1)',
    '  =1+1',
    '\ttexto',
    '\rtexto',
    '\ntexto',
  ]) {
    assert(
      csvCell(value).startsWith('"\''),
      'Texto potencialmente executável deve ser exportado como texto.',
    );
  }
  console.log('OK valores monetários, busca, datas/situação e proteção da exportação CSV.');
} finally {
  fs.rmSync(dir, { recursive: true });
}
