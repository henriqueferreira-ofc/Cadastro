import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import { adminAuth } from '../middleware/adminAuth';
import {
  InputError,
  ConflictError,
  textField,
  positiveInt,
  choice,
  dateOnly,
  month,
  cents,
  paymentDate,
  decodeDocument,
  kinds,
  statuses,
  methods,
} from '../domain/management';
import { auditLog } from '../utils/logger';
import {
  lockMonthlyFee,
  lockFinancialAccount,
  DUE_DAY,
  MONTHLY_AMOUNT_CENTS,
} from '../domain/finance';

const router = Router();
router.use(adminAuth);
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.use((req, res, next) => {
  if (
    req.method === 'POST' &&
    (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))
  ) {
    return res.status(400).json({ error: 'Envie os campos da operação em um objeto JSON.' });
  }
  next();
});
const documentSelect = {
  id: true,
  cadastroId: true,
  title: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
};
const attachmentSelect = {
  id: true,
  postId: true,
  title: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
};
const proofSelect = {
  id: true,
  feeId: true,
  fileName: true,
  mimeType: true,
  size: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedBy: true,
  rejectionReason: true,
};
const feeInclude = {
  cadastro: { select: { id: true, cpf: true, nome: true } },
  payment: true,
  exemption: true,
  proofs: { select: proofSelect, orderBy: { submittedAt: 'desc' as const } },
};
const entryAttachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  size: true,
  createdAt: true,
};
const routeId = (value: unknown) => positiveInt(Number(value));
const postCategories = ['INSTITUCIONAL', 'TRABALHO', 'SECRETARIA', 'FINANCEIRO'] as const;
const postStatuses = ['RASCUNHO', 'PUBLICADO', 'ARQUIVADO'] as const;

async function requireAssociate(id: number) {
  if (!(await prisma.cadastro.findUnique({ where: { id }, select: { id: true } })))
    throw new InputError('Associado não encontrado.');
}

router.get('/ambiente', async (_req, res) => {
  const schema = new URL(process.env.DATABASE_URL || 'postgresql://localhost/').searchParams.get(
    'schema',
  );
  let connected = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    connected = false;
  }
  res.json({ development: schema === 'aafab_desenvolvimento', connected });
});

router.get('/associados', async (_req, res) => {
  const data = await prisma.cadastro.findMany({ orderBy: { nome: 'asc' } });
  res.json(data);
});

router.get('/secretaria/solicitacoes', async (_req, res) => {
  const entries = await prisma.officeEntry.findMany({
    where: { kind: { in: ['SOLICITACAO', 'ISENCAO'] }, visibleToMember: true },
    include: {
      cadastro: { select: { id: true, nome: true, cpf: true } },
      messages: { orderBy: { createdAt: 'asc' } },
      attachments: { select: entryAttachmentSelect, orderBy: { createdAt: 'asc' } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 200,
  });
  res.json(entries);
});

router.get('/secretaria/:cadastroId', async (req, res) => {
  const cadastroId = routeId(req.params.cadastroId);
  await requireAssociate(cadastroId);
  const [entries, documents] = await Promise.all([
    prisma.officeEntry.findMany({
      where: { cadastroId },
      include: {
        events: { orderBy: { createdAt: 'desc' } },
        messages: { orderBy: { createdAt: 'asc' } },
        attachments: { select: entryAttachmentSelect, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.associateDocument.findMany({
      where: { cadastroId },
      select: documentSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  res.json({ entries, documents });
});

router.post('/secretaria', async (req, res) => {
  const cadastroId = positiveInt(req.body.cadastroId);
  const kind = choice(req.body.kind, kinds, 'Tipo');
  const title = textField(req.body.title, 'Assunto', 160);
  const description = textField(req.body.description, 'Descrição', 5000);
  const dueDate = req.body.dueDate ? dateOnly(req.body.dueDate, 'Prazo') : null;
  const visibleToMember = kind !== 'OBSERVACAO' && req.body.visibleToMember === true;
  await requireAssociate(cadastroId);
  const status = kind === 'OBSERVACAO' ? 'CONCLUIDO' : 'ABERTO';
  const entry = await prisma.officeEntry.create({
    data: {
      cadastroId,
      kind,
      title,
      description,
      dueDate,
      status,
      visibleToMember,
      events: { create: { status, note: 'Registro criado.' } },
      ...(visibleToMember
        ? { messages: { create: { sender: 'ADMIN', content: description } } }
        : {}),
    },
    include: { events: true, messages: true },
  });
  res.status(201).json(entry);
});

router.get('/secretaria/anexos/:id/arquivo', async (req, res) => {
  const attachment = await prisma.officeEntryAttachment.findUnique({
    where: { id: routeId(req.params.id) },
  });
  if (!attachment) return res.status(404).json({ error: 'Anexo não encontrado.' });
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="anexo-${attachment.id}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/'/g, '%27')}`,
  );
  res.send(attachment.content);
});

// A Secretaria confere o pedido e o encaminha ao Financeiro, que decide a isenção.
router.post('/secretaria/registros/:id/financeiro', async (req, res) => {
  const id = routeId(req.params.id);
  const entry = await prisma.officeEntry.findUnique({ where: { id } });
  if (!entry || entry.kind !== 'ISENCAO')
    return res.status(404).json({ error: 'Pedido de isenção não encontrado.' });
  if (entry.status === 'CONCLUIDO') throw new ConflictError('Este pedido já foi concluído.');
  if (entry.forwardedToFinanceAt)
    throw new ConflictError('Este pedido já foi encaminhado ao Financeiro.');
  await prisma.officeEntry.update({
    where: { id },
    data: {
      forwardedToFinanceAt: new Date(),
      status: 'EM_ANDAMENTO',
      events: {
        create: { status: 'EM_ANDAMENTO', note: 'Encaminhado ao Financeiro para análise.' },
      },
      messages: {
        create: {
          sender: 'ADMIN',
          content: 'Seu pedido de isenção foi conferido e encaminhado ao Financeiro para decisão.',
        },
      },
    },
  });
  auditLog('EXEMPTION_REQUEST_FORWARDED', 'Pedido de isenção encaminhado ao Financeiro');
  res.json({ success: true });
});

router.post('/secretaria/registros/:id/visibilidade', async (req, res) => {
  const id = routeId(req.params.id);
  if (typeof req.body.visibleToMember !== 'boolean') {
    throw new InputError('Informe se o registro deve aparecer no portal.');
  }
  const entry = await prisma.officeEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: 'Registro não encontrado.' });
  if (entry.kind === 'OBSERVACAO' && req.body.visibleToMember) {
    throw new InputError('Observações internas não podem ser publicadas no portal.');
  }
  const updated = await prisma.officeEntry.update({
    where: { id },
    data: { visibleToMember: req.body.visibleToMember },
    include: { events: { orderBy: { createdAt: 'desc' } } },
  });
  res.json(updated);
});

router.post('/secretaria/registros/:id/historico', async (req, res) => {
  const id = routeId(req.params.id);
  const status = choice(req.body.status, statuses, 'Situação');
  const note = textField(req.body.note, 'Observação', 5000);
  const entry = await prisma.officeEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: 'Registro não encontrado.' });
  if (entry.kind === 'OBSERVACAO' && status !== 'CONCLUIDO')
    throw new InputError('Observações são registros de histórico, sem pendência.');
  const updated = await prisma.officeEntry.update({
    where: { id },
    data: { status, events: { create: { status, note } } },
    include: { events: { orderBy: { createdAt: 'desc' } } },
  });
  res.json(updated);
});

router.post('/secretaria/registros/:id/respostas', async (req, res) => {
  const id = routeId(req.params.id);
  const content = textField(req.body.content, 'Resposta', 5000);
  const status = choice(req.body.status, statuses, 'Situação');
  const entry = await prisma.officeEntry.findUnique({ where: { id } });
  if (!entry) return res.status(404).json({ error: 'Solicitação não encontrada.' });
  if (entry.kind === 'OBSERVACAO' || !entry.visibleToMember) {
    throw new InputError('Este registro é interno e não aceita resposta ao associado.');
  }
  const updated = await prisma.officeEntry.update({
    where: { id },
    data: {
      status,
      messages: { create: { sender: 'ADMIN', content } },
      events: { create: { status, note: 'Resposta enviada ao associado pelo Portal.' } },
    },
    include: {
      events: { orderBy: { createdAt: 'desc' } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  res.json(updated);
});

router.post('/documentos', async (req, res) => {
  const cadastroId = positiveInt(req.body.cadastroId);
  const title = textField(req.body.title, 'Título', 160);
  const fileName = textField(req.body.fileName, 'Nome do arquivo', 200).replace(
    /[\r\n\\/\x00-\x1f]/g,
    '_',
  );
  const mimeType = choice(
    req.body.mimeType,
    ['application/pdf', 'image/jpeg', 'image/png'],
    'Formato',
  );
  const content = decodeDocument(req.body.content, mimeType);
  await requireAssociate(cadastroId);
  const document = await prisma.associateDocument.create({
    data: { cadastroId, title, fileName, mimeType, content, size: content.length },
    select: documentSelect,
  });
  res.status(201).json(document);
});

router.get('/documentos/:id/arquivo', async (req, res) => {
  const document = await prisma.associateDocument.findUnique({
    where: { id: routeId(req.params.id) },
  });
  if (!document) return res.status(404).json({ error: 'Documento não encontrado.' });
  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="documento-${document.id}"; filename*=UTF-8''${encodeURIComponent(document.fileName).replace(/'/g, '%27')}`,
  );
  res.send(document.content);
});

router.get('/mensalidades', async (req, res) => {
  const competence = req.query.competence ? month(req.query.competence) : undefined;
  const data = await prisma.monthlyFee.findMany({
    where: { competence },
    include: feeInclude,
    orderBy: [{ competence: 'desc' }, { dueDate: 'asc' }, { id: 'desc' }],
  });
  res.json(data);
});

router.post('/mensalidades', async (req, res) => {
  const cadastroId = positiveInt(req.body.cadastroId);
  const competence = month(req.body.competence);
  const amountCents = cents(req.body.amountCents);
  const dueDate = dateOnly(req.body.dueDate, 'Data de vencimento');
  const notes = textField(req.body.notes, 'Observações', 2000, false);
  await requireAssociate(cadastroId);
  const fee = await prisma.$transaction(
    async (tx) => {
      await lockFinancialAccount(tx, cadastroId);
      const pending = await tx.paymentProof.findFirst({
        where: { cadastroId, competence, status: 'PENDING' },
      });
      if (pending && pending.amountCents !== amountCents)
        throw new ConflictError(
          'Existe um comprovante em análise com outro valor. Analise-o antes de lançar a mensalidade.',
        );
      const created = await tx.monthlyFee.create({
        data: { cadastroId, competence, amountCents, dueDate, notes },
      });
      await tx.paymentProof.updateMany({
        where: { cadastroId, competence, feeId: null },
        data: { feeId: created.id },
      });
      return tx.monthlyFee.findUnique({ where: { id: created.id }, include: feeInclude });
    },
    { maxWait: 10000, timeout: 15000 },
  );
  res.status(201).json(fee);
});

router.post('/mensalidades/:id/pagamento', async (req, res) => {
  const feeId = routeId(req.params.id);
  const paidAt = paymentDate(req.body.paidAt);
  const method = choice(req.body.method, methods, 'Forma de pagamento');
  const reference = textField(req.body.reference, 'Comprovante ou observação', 500, false);
  const payment = await prisma.$transaction(async (tx) => {
    await lockMonthlyFee(tx, feeId);
    const fee = await tx.monthlyFee.findUnique({
      where: { id: feeId },
      include: {
        payment: true,
        exemption: true,
        proofs: { where: { status: 'PENDING' }, take: 1 },
      },
    });
    if (!fee) return null;
    if (fee.payment) throw new ConflictError('Esta mensalidade já foi paga.');
    if (fee.exemption)
      throw new ConflictError(
        'Esta mensalidade está isenta. Revogue a isenção para registrar pagamento.',
      );
    if (fee.proofs.length) {
      throw new ConflictError(
        'Analise o comprovante pendente antes de registrar uma baixa manual.',
      );
    }
    return tx.feePayment.create({
      data: { feeId, amountCents: fee.amountCents, paidAt, method, reference },
    });
  });
  if (!payment) return res.status(404).json({ error: 'Mensalidade não encontrada.' });
  res.status(201).json(payment);
});

const monthText = (competence: string) => competence.split('-').reverse().join('/');
const requestSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  forwardedToFinanceAt: true,
  cadastro: { select: { id: true, nome: true, cpf: true } },
  messages: { orderBy: { createdAt: 'asc' as const } },
  attachments: { select: entryAttachmentSelect, orderBy: { createdAt: 'asc' as const } },
};

// Pedidos de isenção que a Secretaria já encaminhou e ainda aguardam decisão.
router.get('/isencoes/pedidos', async (_req, res) => {
  const requests = await prisma.officeEntry.findMany({
    where: { kind: 'ISENCAO', forwardedToFinanceAt: { not: null }, status: { not: 'CONCLUIDO' } },
    select: requestSelect,
    orderBy: [{ forwardedToFinanceAt: 'asc' }, { id: 'asc' }],
  });
  res.json(requests);
});

router.post('/isencoes/pedidos/:id/recusar', async (req, res) => {
  const id = routeId(req.params.id);
  const reason = textField(req.body.reason, 'Motivo da recusa', 1000);
  const entry = await prisma.officeEntry.findUnique({ where: { id } });
  if (!entry || entry.kind !== 'ISENCAO' || !entry.forwardedToFinanceAt)
    return res.status(404).json({ error: 'Pedido de isenção não encontrado.' });
  if (entry.status === 'CONCLUIDO') throw new ConflictError('Este pedido já foi concluído.');
  await prisma.officeEntry.update({
    where: { id },
    data: {
      status: 'CONCLUIDO',
      events: { create: { status: 'CONCLUIDO', note: `Isenção não aprovada: ${reason}` } },
      messages: {
        create: {
          sender: 'ADMIN',
          content: `Pedido de isenção não aprovado pelo Financeiro: ${reason}`,
        },
      },
    },
  });
  auditLog('EXEMPTION_REQUEST_DECLINED', 'Pedido de isenção recusado');
  res.json({ success: true });
});

// Isenta um período (até 60 meses, inclusive um ano inteiro). Meses já pagos ou com comprovante
// em análise são preservados e informados; os demais viram "Isento" na mesma transação.
router.post('/isencoes', async (req, res) => {
  const cadastroId = positiveInt(req.body.cadastroId);
  const reason = textField(req.body.reason, 'Justificativa', 1000);
  const requestId = req.body.requestId === undefined ? null : positiveInt(req.body.requestId);
  const list: unknown = req.body.competences;
  if (!Array.isArray(list) || list.length < 1 || list.length > 60)
    throw new InputError('Informe de 1 a 60 meses para isentar.');
  const competences = [...new Set(list.map((item) => month(item)))].sort();
  await requireAssociate(cadastroId);
  const result = await prisma.$transaction(
    async (tx) => {
      await lockFinancialAccount(tx, cadastroId);
      const request = requestId
        ? await tx.officeEntry.findFirst({
            where: { id: requestId, cadastroId, kind: 'ISENCAO' },
          })
        : null;
      if (requestId && (!request || request.status === 'CONCLUIDO'))
        throw new ConflictError('Pedido de isenção não encontrado ou já concluído.');
      const granted: string[] = [];
      const already: string[] = [];
      const blocked: string[] = [];
      for (const competence of competences) {
        const fee =
          (await tx.monthlyFee.findUnique({
            where: { cadastroId_competence: { cadastroId, competence } },
          })) ??
          (await tx.monthlyFee.create({
            data: {
              cadastroId,
              competence,
              amountCents: MONTHLY_AMOUNT_CENTS,
              dueDate: new Date(`${competence}-${DUE_DAY}T00:00:00.000Z`),
            },
          }));
        await lockMonthlyFee(tx, fee.id);
        const [payment, exemption, pending] = await Promise.all([
          tx.feePayment.findUnique({ where: { feeId: fee.id } }),
          tx.feeExemption.findUnique({ where: { feeId: fee.id } }),
          tx.paymentProof.findFirst({
            where: { cadastroId, competence, status: 'PENDING' },
            select: { id: true },
          }),
        ]);
        if (payment || pending) {
          blocked.push(competence);
          continue;
        }
        if (exemption) {
          already.push(competence);
          continue;
        }
        await tx.feeExemption.create({ data: { feeId: fee.id, reason } });
        await tx.paymentProof.updateMany({
          where: { cadastroId, competence, feeId: null },
          data: { feeId: fee.id },
        });
        granted.push(competence);
      }
      if (!granted.length && !already.length)
        throw new ConflictError(
          `Nenhum mês pôde ser isentado: já pagos ou com comprovante em análise (${blocked.map(monthText).join(', ')}).`,
        );
      if (request) {
        const text = granted.length ? granted.map(monthText).join(', ') : 'meses já isentos';
        await tx.officeEntry.update({
          where: { id: request.id },
          data: {
            status: 'CONCLUIDO',
            events: { create: { status: 'CONCLUIDO', note: `Isenção concedida: ${text}.` } },
            messages: {
              create: {
                sender: 'ADMIN',
                content: `Isenção aprovada pelo Financeiro para: ${text}. Justificativa registrada: ${reason}`,
              },
            },
          },
        });
      }
      return { granted: granted.length, skipped: already.length, blocked };
    },
    { maxWait: 10000, timeout: 30000 },
  );
  auditLog('FEE_EXEMPTION_GRANTED', `Isenção concedida (${result.granted} mês(es))`);
  res.status(201).json(result);
});

router.post('/mensalidades/:id/isencao/revogar', async (req, res) => {
  const feeId = routeId(req.params.id);
  const removed = await prisma.feeExemption.deleteMany({ where: { feeId } });
  if (!removed.count) return res.status(404).json({ error: 'Esta mensalidade não está isenta.' });
  auditLog('FEE_EXEMPTION_REVOKED', 'Isenção revogada');
  res.json({ success: true });
});

router.get('/comprovantes', async (req, res) => {
  const status = req.query.status
    ? choice(req.query.status, ['PENDING', 'APPROVED', 'REJECTED'], 'Situação')
    : undefined;
  const proofs = await prisma.paymentProof.findMany({
    where: { status },
    select: {
      ...proofSelect,
      competence: true,
      amountCents: true,
      cadastro: { select: { id: true, cpf: true, nome: true } },
      fee: {
        select: {
          id: true,
          competence: true,
          amountCents: true,
          dueDate: true,
          payment: true,
          cadastro: { select: { id: true, cpf: true, nome: true } },
        },
      },
    },
    orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
  });
  res.json(proofs);
});

router.get('/comprovantes/:id/arquivo', async (req, res) => {
  const proof = await prisma.paymentProof.findUnique({ where: { id: routeId(req.params.id) } });
  if (!proof) return res.status(404).json({ error: 'Comprovante não encontrado.' });
  res.setHeader('Content-Type', proof.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="comprovante-${proof.id}"; filename*=UTF-8''${encodeURIComponent(proof.fileName).replace(/'/g, '%27')}`,
  );
  res.send(proof.content);
});

router.post('/comprovantes/:id/aprovar', async (req, res) => {
  const id = routeId(req.params.id);
  const paidAt = paymentDate(req.body.paidAt);
  const proof = await prisma.paymentProof.findUnique({
    where: { id },
    include: { fee: { include: { payment: true } } },
  });
  if (!proof) return res.status(404).json({ error: 'Comprovante não encontrado.' });
  if (proof.status !== 'PENDING') {
    return res.status(409).json({ error: 'Este comprovante já foi analisado.' });
  }
  if (proof.fee?.payment) {
    return res.status(409).json({ error: 'Esta mensalidade já possui pagamento registrado.' });
  }
  const result = await prisma.$transaction(
    async (tx) => {
      await lockFinancialAccount(tx, proof.cadastroId);
      const current = await tx.paymentProof.findUnique({ where: { id } });
      if (!current || current.status !== 'PENDING')
        throw new ConflictError('Este comprovante já foi analisado.');
      let fee = await tx.monthlyFee.findUnique({
        where: {
          cadastroId_competence: { cadastroId: proof.cadastroId, competence: proof.competence },
        },
      });
      if (!fee) {
        const dueDate = dateOnly(req.body.dueDate, 'Data de vencimento');
        fee = await tx.monthlyFee.create({
          data: {
            cadastroId: proof.cadastroId,
            competence: proof.competence,
            amountCents: proof.amountCents,
            dueDate,
          },
        });
      }
      await lockMonthlyFee(tx, fee.id);
      if (fee.amountCents !== proof.amountCents)
        throw new ConflictError(
          'O valor do comprovante difere da mensalidade. Confira o lançamento antes de aprovar.',
        );
      if (await tx.feePayment.findUnique({ where: { feeId: fee.id } }))
        throw new ConflictError('Esta mensalidade já possui pagamento registrado.');
      if (await tx.feeExemption.findUnique({ where: { feeId: fee.id } }))
        throw new ConflictError(
          'Esta mensalidade está isenta. Revogue a isenção antes de aprovar o comprovante.',
        );
      const claimed = await tx.paymentProof.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          feeId: fee.id,
          reviewedAt: new Date(),
          reviewedBy: 'Secretaria',
          rejectionReason: null,
        },
      });
      if (claimed.count !== 1) throw new ConflictError('Este comprovante já foi analisado.');
      const payment = await tx.feePayment.create({
        data: {
          feeId: fee.id,
          amountCents: fee.amountCents,
          paidAt,
          method: 'PIX',
          reference: `Comprovante enviado no portal #${proof.id}`,
        },
      });
      await tx.paymentProof.updateMany({
        where: { cadastroId: proof.cadastroId, competence: proof.competence, feeId: null },
        data: { feeId: fee.id },
      });
      return { payment };
    },
    { maxWait: 10000, timeout: 15000 },
  );
  res.json(result);
});

router.post('/comprovantes/:id/recusar', async (req, res) => {
  const id = routeId(req.params.id);
  const rejectionReason = textField(req.body.reason, 'Motivo da recusa', 1000);
  const updated = await prisma.paymentProof.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: 'Secretaria', rejectionReason },
  });
  if (updated.count !== 1) {
    const exists = await prisma.paymentProof.findUnique({ where: { id }, select: { id: true } });
    return res.status(exists ? 409 : 404).json({
      error: exists ? 'Este comprovante já foi analisado.' : 'Comprovante não encontrado.',
    });
  }
  res.json({ success: true });
});

router.get('/comunicados', async (_req, res) => {
  const posts = await prisma.associationPost.findMany({
    include: { attachments: { select: attachmentSelect, orderBy: { createdAt: 'asc' } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  res.json(posts);
});

router.post('/comunicados/:id/anexos', async (req, res) => {
  const postId = routeId(req.params.id);
  const title = textField(req.body.title, 'Título do anexo', 160);
  const fileName = textField(req.body.fileName, 'Nome do arquivo', 200).replace(
    /[\r\n\\/\x00-\x1f]/g,
    '_',
  );
  const mimeType = choice(
    req.body.mimeType,
    ['application/pdf', 'image/jpeg', 'image/png'],
    'Formato',
  );
  const content = decodeDocument(req.body.content, mimeType);
  if (!(await prisma.associationPost.findUnique({ where: { id: postId }, select: { id: true } }))) {
    return res.status(404).json({ error: 'Comunicado não encontrado.' });
  }
  const attachment = await prisma.associationPostAttachment.create({
    data: { postId, title, fileName, mimeType, size: content.length, content },
    select: attachmentSelect,
  });
  res.status(201).json(attachment);
});

router.get('/comunicados/anexos/:id/arquivo', async (req, res) => {
  const attachment = await prisma.associationPostAttachment.findUnique({
    where: { id: routeId(req.params.id) },
  });
  if (!attachment) return res.status(404).json({ error: 'Anexo não encontrado.' });
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="anexo-${attachment.id}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/'/g, '%27')}`,
  );
  res.send(attachment.content);
});

router.post('/comunicados', async (req, res) => {
  const title = textField(req.body.title, 'Título', 160);
  const summary = textField(req.body.summary, 'Resumo', 400);
  const content = textField(req.body.content, 'Conteúdo', 10000);
  const category = choice(req.body.category, postCategories, 'Categoria');
  const status = choice(req.body.status, postStatuses, 'Situação');
  const post = await prisma.associationPost.create({
    data: {
      title,
      summary,
      content,
      category,
      status,
      audience: 'ASSOCIADOS',
      publishedAt: status === 'PUBLICADO' ? new Date() : null,
    },
  });
  res.status(201).json(post);
});

router.post('/comunicados/:id', async (req, res) => {
  const id = routeId(req.params.id);
  const title = textField(req.body.title, 'Título', 160);
  const summary = textField(req.body.summary, 'Resumo', 400);
  const content = textField(req.body.content, 'Conteúdo', 10000);
  const category = choice(req.body.category, postCategories, 'Categoria');
  const status = choice(req.body.status, postStatuses, 'Situação');
  const current = await prisma.associationPost.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: 'Comunicado não encontrado.' });
  const post = await prisma.associationPost.update({
    where: { id },
    data: {
      title,
      summary,
      content,
      category,
      status,
      publishedAt: status === 'PUBLICADO' ? current.publishedAt || new Date() : current.publishedAt,
    },
  });
  res.json(post);
});

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ConflictError) return res.status(409).json({ error: error.message });
  if (error instanceof InputError) return res.status(400).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      return res.status(409).json({
        error:
          'Registro duplicado: confira se já existe mensalidade para este associado e mês, ou se o pagamento já foi registrado.',
      });
    if (error.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado.' });
    if (error.code === 'P2021')
      return res
        .status(503)
        .json({ error: 'Os módulos de gestão ainda precisam ser preparados no banco de dados.' });
  }
  console.error('Falha na gestão:', error instanceof Error ? error.name : 'Erro desconhecido');
  res.status(500).json({ error: 'Não foi possível concluir a operação. Tente novamente.' });
});

export default router;
