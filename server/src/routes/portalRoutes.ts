import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import prisma from '../db';
import { memberAuth, type MemberAuthContext } from '../middleware/memberAuth';
import { normalizeCpf } from '../utils/normalizeCpf';
import { validateCPF } from '../utils/cpfValidator';
import { generateMemberToken } from '../utils/jwt';
import { hashPassword, validatePassword, verifyPassword } from '../utils/password';
import { generateAccessCode, hashPortalActivationCode, sameHash } from '../utils/registrationCode';
import { activationEmail, maskEmail, sendMail } from '../utils/mailer';
import { auditLog } from '../utils/logger';
import {
  ConflictError,
  InputError,
  decodeDocument,
  positiveInt,
  month,
  textField,
} from '../domain/management';
import {
  lockMonthlyFee,
  lockFinancialAccount,
  ensureYearFees,
  saoPauloToday,
  MONTHLY_AMOUNT_CENTS,
} from '../domain/finance';
import { createPixCharge } from '../utils/pix';

const router = Router();
const genericLoginError = 'CPF ou senha inválidos.';
const genericActivationError =
  'Não foi possível ativar o acesso. Confira o código ou procure a Secretaria da AAFAB.';
const dummyPasswordHash = hashPassword('validacao-segura-123');

router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const safeProfile = (cadastro: {
  id: number;
  cpf: string;
  nome: string;
  estado: string;
  turma_cesd: string;
  rg: string;
  email: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  data_envio: Date;
  status: string;
}) => ({
  id: cadastro.id,
  cpf: cadastro.cpf,
  nome: cadastro.nome,
  estado: cadastro.estado,
  turma: cadastro.turma_cesd,
  rg: cadastro.rg,
  email: cadastro.email,
  telefone: cadastro.telefone,
  endereco: cadastro.endereco,
  bairro: cadastro.bairro,
  cidade: cadastro.cidade,
  cep: cadastro.cep,
  dataCadastro: cadastro.data_envio,
  status: cadastro.status,
});

router.post('/login', async (req, res) => {
  const cpf = normalizeCpf(req.body?.cpf);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!validateCPF(cpf) || !password || password.length > 128) {
    return res.status(401).json({ error: genericLoginError });
  }
  try {
    const [cadastro, member] = await Promise.all([
      prisma.cadastro.findUnique({ where: { cpf }, include: { account: true } }),
      prisma.member.findUnique({ where: { cpf }, select: { status: true } }),
    ]);
    const account = cadastro?.account;
    const passwordMatches = await verifyPassword(
      password,
      account?.passwordHash || (await dummyPasswordHash),
    );
    const now = new Date();
    if (
      !cadastro ||
      !account?.passwordHash ||
      member?.status !== 'ACTIVE' ||
      (account.lockedUntil && account.lockedUntil > now) ||
      !passwordMatches
    ) {
      if (account && (!account.lockedUntil || account.lockedUntil <= now)) {
        const failures = Math.min(account.failedLoginCount + 1, 1000);
        await prisma.memberAccount.update({
          where: { id: account.id },
          data: {
            failedLoginCount: failures,
            lockedUntil: failures >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
          },
        });
      }
      auditLog('MEMBER_LOGIN_FAILED', 'Tentativa de acesso ao portal recusada');
      return res.status(401).json({ error: genericLoginError });
    }
    await prisma.memberAccount.update({
      where: { id: account.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now },
    });
    const token = generateMemberToken({
      accountId: account.id,
      cadastroId: cadastro.id,
      sessionVersion: account.sessionVersion,
    });
    auditLog('MEMBER_LOGIN', 'Acesso ao Portal do Associado realizado');
    return res.json({ token, expiresIn: '8h', profile: safeProfile(cadastro) });
  } catch {
    return res.status(500).json({ error: 'Não foi possível acessar o portal neste momento.' });
  }
});

const ACTIVATION_EMAIL_MINUTES = 15;
const emailSendLog = new Map<string, number[]>();
const wrongCodeAttempts = new Map<string, number>();

// Associado com cadastro recebe o código no e-mail cadastrado: para criar a senha (primeiro acesso)
// ou para redefini-la (esqueci minha senha). Responde sempre 200 com um "status" que orienta a
// tela; nenhum dado pessoal é devolvido, exceto o e-mail mascarado do próprio titular.
function codeByEmail(purpose: 'ACTIVATION' | 'RESET') {
  return async (req: Request, res: Response) => {
    const cpf = normalizeCpf(req.body?.cpf);
    if (!validateCPF(cpf)) return res.status(400).json({ error: 'Informe um CPF válido.' });
    try {
      const [cadastro, member] = await Promise.all([
        prisma.cadastro.findUnique({ where: { cpf }, include: { account: true } }),
        prisma.member.findUnique({ where: { cpf }, select: { status: true } }),
      ]);
      if (!cadastro) return res.json({ status: member ? 'NEEDS_REGISTRATION' : 'NOT_FOUND' });
      if (member?.status !== 'ACTIVE') return res.json({ status: 'CONTACT_SECRETARY' });
      const hasPassword = !!cadastro.account?.passwordHash;
      if (purpose === 'ACTIVATION' && hasPassword) return res.json({ status: 'HAS_PASSWORD' });
      if (purpose === 'RESET' && !hasPassword) return res.json({ status: 'NO_PASSWORD' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cadastro.email)) {
        return res.json({ status: 'CONTACT_SECRETARY' });
      }

      // Os limites valem por CPF para os dois tipos de pedido juntos.
      const now = Date.now();
      if (emailSendLog.size > 5000) emailSendLog.clear();
      const sent = (emailSendLog.get(cpf) ?? []).filter((time) => now - time < 60 * 60 * 1000);
      const last = sent[sent.length - 1];
      if (last && now - last < 60 * 1000) {
        return res.json({
          status: 'WAIT',
          retryInSeconds: Math.ceil((60 * 1000 - (now - last)) / 1000),
        });
      }
      if (sent.length >= 3) {
        return res.json({
          status: 'WAIT',
          retryInSeconds: Math.ceil((60 * 60 * 1000 - (now - sent[0])) / 1000),
        });
      }

      const code = generateAccessCode();
      const expiresAt = new Date(now + ACTIVATION_EMAIL_MINUTES * 60 * 1000);
      const hash = hashPortalActivationCode(cpf, code);
      await prisma.memberAccount.upsert({
        where: { cadastroId: cadastro.id },
        create: {
          cadastroId: cadastro.id,
          activationCodeHash: hash,
          activationCodeExpiresAt: expiresAt,
        },
        // Na redefinição a senha atual continua valendo até o código ser usado.
        update:
          purpose === 'RESET'
            ? {
                activationCodeHash: hash,
                activationCodeExpiresAt: expiresAt,
                activationCodeUsedAt: null,
              }
            : {
                activationCodeHash: hash,
                activationCodeExpiresAt: expiresAt,
                activationCodeUsedAt: null,
                failedLoginCount: 0,
                lockedUntil: null,
              },
      });
      const delivered = await sendMail({
        ...activationEmail(
          cadastro.nome,
          code,
          ACTIVATION_EMAIL_MINUTES,
          purpose === 'RESET' ? 'RESET' : 'ACTIVATION',
        ),
        to: cadastro.email,
        toName: cadastro.nome,
      });
      if (!delivered) {
        await prisma.memberAccount.updateMany({
          where: { cadastroId: cadastro.id, activationCodeHash: hash },
          data: { activationCodeHash: null, activationCodeExpiresAt: null },
        });
        auditLog('MEMBER_ACTIVATION_EMAIL_FAILED', 'Falha ao enviar o código por e-mail');
        return res.status(503).json({
          status: 'EMAIL_FAILED',
          error:
            'Não foi possível enviar o e-mail agora. Tente mais tarde ou procure a Secretaria.',
        });
      }
      sent.push(now);
      emailSendLog.set(cpf, sent);
      wrongCodeAttempts.delete(cpf);
      auditLog(
        purpose === 'RESET' ? 'MEMBER_PASSWORD_RESET_EMAIL' : 'MEMBER_ACTIVATION_EMAIL',
        purpose === 'RESET'
          ? 'Código de redefinição de senha enviado por e-mail'
          : 'Código de ativação enviado por e-mail',
      );
      return res.json({
        status: 'EMAIL_SENT',
        maskedEmail: maskEmail(cadastro.email),
        expiresInMinutes: ACTIVATION_EMAIL_MINUTES,
      });
    } catch {
      return res.status(500).json({ error: 'Não foi possível enviar o código neste momento.' });
    }
  };
}

router.post('/activation-email', codeByEmail('ACTIVATION'));
router.post('/password-reset-email', codeByEmail('RESET'));

router.post('/activate', async (req, res) => {
  const cpf = normalizeCpf(req.body?.cpf);
  const code = String(req.body?.code || '').replace(/\D/g, '');
  const password = req.body?.password;
  const passwordError = validatePassword(password);
  if (!validateCPF(cpf) || !/^\d{8}$/.test(code) || passwordError) {
    return res.status(400).json({ error: passwordError || genericActivationError });
  }
  try {
    const [cadastro, member] = await Promise.all([
      prisma.cadastro.findUnique({ where: { cpf }, include: { account: true } }),
      prisma.member.findUnique({ where: { cpf }, select: { status: true } }),
    ]);
    const account = cadastro?.account;
    const suppliedHash = hashPortalActivationCode(cpf, code);
    const codeIsValid =
      !!cadastro &&
      member?.status === 'ACTIVE' &&
      !!account?.activationCodeHash &&
      !!account.activationCodeExpiresAt &&
      !account.activationCodeUsedAt &&
      account.activationCodeExpiresAt.getTime() > Date.now() &&
      sameHash(account.activationCodeHash, suppliedHash);
    if (!cadastro || !account || !codeIsValid) {
      // Cinco códigos errados seguidos invalidam o código em vigor; o titular pede outro por e-mail.
      if (cadastro && account?.activationCodeHash && !account.activationCodeUsedAt) {
        if (wrongCodeAttempts.size > 5000) wrongCodeAttempts.clear();
        const attempts = (wrongCodeAttempts.get(cpf) ?? 0) + 1;
        wrongCodeAttempts.set(cpf, attempts);
        if (attempts >= 5) {
          await prisma.memberAccount.updateMany({
            where: { id: account.id },
            data: { activationCodeHash: null, activationCodeExpiresAt: null },
          });
          wrongCodeAttempts.delete(cpf);
          auditLog(
            'MEMBER_ACTIVATION_CODE_REVOKED',
            'Código de ativação invalidado por tentativas',
          );
        }
      }
      auditLog('MEMBER_ACTIVATION_DENIED', 'Ativação do portal recusada');
      return res.status(400).json({ error: genericActivationError });
    }
    const encodedPassword = await hashPassword(password);
    const claimed = await prisma.memberAccount.updateMany({
      where: {
        id: account.id,
        activationCodeHash: suppliedHash,
        activationCodeUsedAt: null,
        activationCodeExpiresAt: { gt: new Date() },
      },
      data: {
        passwordHash: encodedPassword,
        passwordCreatedAt: new Date(),
        activationCodeHash: null,
        activationCodeExpiresAt: null,
        activationCodeUsedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
        lastLoginAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      auditLog('MEMBER_ACTIVATION_DENIED', 'Código de ativação já utilizado ou expirado');
      return res.status(400).json({ error: genericActivationError });
    }
    const activated = await prisma.memberAccount.findUnique({ where: { id: account.id } });
    if (!activated) return res.status(400).json({ error: genericActivationError });
    const token = generateMemberToken({
      accountId: activated.id,
      cadastroId: cadastro.id,
      sessionVersion: activated.sessionVersion,
    });
    auditLog('MEMBER_ACCOUNT_ACTIVATED', 'Conta do Portal do Associado ativada');
    return res.json({ token, expiresIn: '8h', profile: safeProfile(cadastro) });
  } catch {
    return res.status(500).json({ error: 'Não foi possível ativar o portal neste momento.' });
  }
});

router.use(memberAuth);

router.post('/logout', async (_req, res) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    await prisma.memberAccount.update({
      where: { id: auth.accountId },
      data: { sessionVersion: { increment: 1 } },
    });
    auditLog('MEMBER_LOGOUT', 'Sessão do Portal do Associado encerrada');
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Não foi possível encerrar a sessão no servidor.' });
  }
});

router.get('/overview', async (_req, res) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    const today = saoPauloToday();
    await ensureYearFees(prisma, auth.cadastroId, Number(today.slice(0, 4)));
    const [cadastro, posts] = await Promise.all([
      prisma.cadastro.findUnique({
        where: { id: auth.cadastroId },
        include: {
          paymentProofs: {
            where: { feeId: null },
            select: {
              id: true,
              competence: true,
              amountCents: true,
              fileName: true,
              mimeType: true,
              size: true,
              status: true,
              submittedAt: true,
              reviewedAt: true,
              rejectionReason: true,
            },
            orderBy: { submittedAt: 'desc' },
          },
          monthlyFees: {
            include: {
              payment: true,
              exemption: { select: { reason: true, grantedBy: true, createdAt: true } },
              proofs: {
                select: {
                  id: true,
                  fileName: true,
                  mimeType: true,
                  size: true,
                  status: true,
                  submittedAt: true,
                  reviewedAt: true,
                  rejectionReason: true,
                },
                orderBy: { submittedAt: 'desc' },
              },
            },
            orderBy: [{ competence: 'desc' }, { dueDate: 'desc' }],
          },
          officeEntries: {
            where: {
              visibleToMember: true,
              kind: { in: ['ATENDIMENTO', 'SOLICITACAO', 'PENDENCIA', 'ISENCAO'] },
            },
            select: {
              id: true,
              attachments: {
                select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
              },
              kind: true,
              title: true,
              description: true,
              status: true,
              dueDate: true,
              createdAt: true,
              updatedAt: true,
              messages: {
                select: { id: true, sender: true, content: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.associationPost.findMany({
        where: {
          status: 'PUBLICADO',
          audience: { in: ['ASSOCIADOS', 'TODOS'] },
          publishedAt: { lte: new Date() },
        },
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          category: true,
          publishedAt: true,
          attachments: {
            select: {
              id: true,
              title: true,
              fileName: true,
              mimeType: true,
              size: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { publishedAt: 'desc' },
        take: 50,
      }),
    ]);
    if (!cadastro) return res.status(404).json({ error: 'Cadastro não encontrado.' });
    const fees = cadastro.monthlyFees.map((fee) => {
      const proof = fee.proofs[0] || null;
      const status = fee.payment
        ? 'PAGO'
        : fee.exemption
          ? 'ISENTO'
          : proof?.status === 'PENDING'
            ? 'EM_ANALISE'
            : fee.dueDate.toISOString().slice(0, 10) < today
              ? 'VENCIDO'
              : 'ABERTO';
      return {
        id: fee.id,
        competence: fee.competence,
        amountCents: fee.amountCents,
        dueDate: fee.dueDate,
        notes: fee.notes,
        status,
        exemption: fee.exemption,
        proof,
        payment: fee.payment
          ? {
              amountCents: fee.payment.amountCents,
              paidAt: fee.payment.paidAt,
              method: fee.payment.method,
            }
          : null,
      };
    });
    return res.json({
      profile: safeProfile(cadastro),
      posts,
      secretary: { entries: cadastro.officeEntries },
      finance: {
        currentYear: Number(today.slice(0, 4)),
        fees,
        standaloneProofs: cadastro.paymentProofs,
        receivedCents: fees.reduce((total, fee) => total + (fee.payment?.amountCents || 0), 0),
        openCents: fees
          .filter((fee) => !fee.payment && !fee.exemption)
          .reduce((total, fee) => total + fee.amountCents, 0),
        overdueCents: fees
          .filter((fee) => fee.status === 'VENCIDO')
          .reduce((total, fee) => total + fee.amountCents, 0),
        reviewCents:
          fees
            .filter((fee) => fee.status === 'EM_ANALISE')
            .reduce((total, fee) => total + fee.amountCents, 0) +
          cadastro.paymentProofs
            .filter((proof) => proof.status === 'PENDING')
            .reduce((total, proof) => total + proof.amountCents, 0),
      },
    });
  } catch {
    return res.status(500).json({ error: 'Não foi possível carregar o Portal do Associado.' });
  }
});

router.post('/secretaria/requests', async (req, res, next) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    const title = textField(req.body?.title, 'Assunto', 160);
    const description = textField(req.body?.description, 'Descrição', 3000);
    const entry = await prisma.officeEntry.create({
      data: {
        cadastroId: auth.cadastroId,
        kind: 'SOLICITACAO',
        title,
        description,
        status: 'ABERTO',
        visibleToMember: true,
        events: { create: { status: 'ABERTO', note: 'Solicitação enviada pelo associado.' } },
        messages: { create: { sender: 'MEMBER', content: description } },
      },
      select: {
        id: true,
        kind: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: { id: true, sender: true, content: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    auditLog('MEMBER_SECRETARY_REQUEST', 'Solicitação enviada pelo Portal do Associado');
    return res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

// Pedido de isenção: justificativa por escrito e, opcionalmente, laudo ou outro documento.
router.post('/secretaria/exemption-requests', async (req, res, next) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    const description = textField(req.body?.description, 'Justificativa', 3000);
    const period = textField(req.body?.period, 'Período', 200, false);
    const hasFile = req.body?.content !== undefined;
    const fileName = hasFile
      ? textField(req.body?.fileName, 'Nome do arquivo', 200).replace(/[\r\n\\/\x00-\x1f]/g, '_')
      : '';
    const mimeType = req.body?.mimeType;
    const content = hasFile ? decodeDocument(req.body?.content, mimeType) : null;
    const text = period ? `Período desejado: ${period}\n\n${description}` : description;
    const open = await prisma.officeEntry.count({
      where: { cadastroId: auth.cadastroId, kind: 'ISENCAO', status: { not: 'CONCLUIDO' } },
    });
    if (open >= 3)
      throw new ConflictError(
        'Você já tem pedidos de isenção em andamento. Aguarde a resposta ou escreva na conversa.',
      );
    const entry = await prisma.officeEntry.create({
      data: {
        cadastroId: auth.cadastroId,
        kind: 'ISENCAO',
        title: 'Pedido de isenção de mensalidades',
        description: text,
        status: 'ABERTO',
        visibleToMember: true,
        events: { create: { status: 'ABERTO', note: 'Pedido de isenção enviado pelo associado.' } },
        messages: { create: { sender: 'MEMBER', content: text } },
        ...(content
          ? {
              attachments: {
                create: { fileName, mimeType, size: content.length, content },
              },
            }
          : {}),
      },
      select: { id: true },
    });
    auditLog('MEMBER_EXEMPTION_REQUEST', 'Pedido de isenção enviado pelo Portal do Associado');
    return res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

router.get('/secretaria/attachments/:id/file', async (req, res) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  const attachment = await prisma.officeEntryAttachment.findFirst({
    where: {
      id: Number(req.params.id) || 0,
      entry: { cadastroId: auth.cadastroId, visibleToMember: true },
    },
  });
  if (!attachment) return res.status(404).json({ error: 'Anexo não encontrado.' });
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="anexo-${attachment.id}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/'/g, '%27')}`,
  );
  return res.send(attachment.content);
});

router.post('/secretaria/requests/:id/messages', async (req, res, next) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    const id = positiveInt(Number(req.params.id));
    const content = textField(req.body?.content, 'Mensagem', 5000);
    const entry = await prisma.officeEntry.findFirst({
      where: {
        id,
        cadastroId: auth.cadastroId,
        visibleToMember: true,
        kind: { in: ['ATENDIMENTO', 'SOLICITACAO', 'PENDENCIA', 'ISENCAO'] },
      },
    });
    if (!entry) return res.status(404).json({ error: 'Solicitação não encontrada.' });
    if (entry.status === 'CONCLUIDO') {
      return res
        .status(409)
        .json({ error: 'Este atendimento foi concluído. Abra uma nova solicitação.' });
    }
    const updated = await prisma.officeEntry.update({
      where: { id },
      data: {
        status: 'ABERTO',
        messages: { create: { sender: 'MEMBER', content } },
        events: { create: { status: 'ABERTO', note: 'Nova mensagem enviada pelo associado.' } },
      },
      select: {
        id: true,
        kind: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          select: { id: true, sender: true, content: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    auditLog('MEMBER_SECRETARY_MESSAGE', 'Mensagem enviada à Secretaria');
    return res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/finance/fees/:id/pix', async (req, res, next) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    const id = positiveInt(Number(req.params.id));
    const fee = await prisma.monthlyFee.findFirst({
      where: { id, cadastroId: auth.cadastroId },
      include: {
        payment: true,
        exemption: true,
        proofs: { where: { status: 'PENDING' }, take: 1 },
      },
    });
    if (!fee) return res.status(404).json({ error: 'Mensalidade não encontrada.' });
    if (fee.exemption) return res.status(409).json({ error: 'Esta mensalidade está isenta.' });
    if (fee.payment) return res.status(409).json({ error: 'Esta mensalidade já está paga.' });
    if (fee.proofs.length) {
      return res.status(409).json({ error: 'O comprovante desta mensalidade já está em análise.' });
    }
    return res.json(createPixCharge(fee.amountCents, fee.id));
  } catch (error) {
    next(error);
  }
});

router.post('/finance/proofs', async (req, res, next) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  try {
    const feeId = req.body?.feeId === undefined ? null : positiveInt(req.body.feeId, 'Mensalidade');
    const competence = feeId === null ? month(req.body?.competence) : null;
    const fileName = textField(req.body?.fileName, 'Nome do arquivo', 200).replace(
      /[\r\n\\/\x00-\x1f]/g,
      '_',
    );
    const mimeType = req.body?.mimeType;
    const content = decodeDocument(req.body?.content, mimeType);
    const proof = await prisma.$transaction(
      async (tx) => {
        await lockFinancialAccount(tx, auth.cadastroId);
        const found = await tx.monthlyFee.findFirst({
          where: {
            cadastroId: auth.cadastroId,
            ...(feeId === null ? { competence: competence! } : { id: feeId }),
          },
          select: { id: true },
        });
        if (feeId !== null && !found) return null;
        if (found) await lockMonthlyFee(tx, found.id);
        const fee = found
          ? await tx.monthlyFee.findUnique({
              where: { id: found.id },
              include: {
                payment: true,
                exemption: true,
                proofs: { where: { status: 'PENDING' }, take: 1 },
              },
            })
          : null;
        if (fee?.payment) throw new ConflictError('Esta mensalidade já está paga.');
        if (fee?.exemption) throw new ConflictError('Esta mensalidade está isenta.');
        const referenceMonth = fee?.competence || competence!;
        if (
          await tx.paymentProof.findFirst({
            where: { cadastroId: auth.cadastroId, competence: referenceMonth, status: 'PENDING' },
            select: { id: true },
          })
        ) {
          throw new ConflictError('Já existe um comprovante em análise para esta mensalidade.');
        }
        return tx.paymentProof.create({
          data: {
            feeId: fee?.id ?? null,
            cadastroId: auth.cadastroId,
            competence: referenceMonth,
            amountCents: fee?.amountCents ?? MONTHLY_AMOUNT_CENTS,
            fileName,
            mimeType,
            size: content.length,
            content,
            contentHash: createHash('sha256').update(content).digest('hex'),
          },
          select: {
            id: true,
            feeId: true,
            fileName: true,
            mimeType: true,
            size: true,
            status: true,
            submittedAt: true,
          },
        });
      },
      { maxWait: 10000, timeout: 15000 },
    );
    if (!proof) return res.status(404).json({ error: 'Mensalidade não encontrada.' });
    auditLog('MEMBER_PAYMENT_PROOF', 'Comprovante financeiro enviado para análise');
    return res.status(201).json(proof);
  } catch (error) {
    next(error);
  }
});

router.get('/finance/proofs/:id/file', async (req, res) => {
  const auth = res.locals.memberAuth as MemberAuthContext;
  const proof = await prisma.paymentProof.findFirst({
    where: { id: positiveInt(Number(req.params.id)), cadastroId: auth.cadastroId },
  });
  if (!proof) return res.status(404).json({ error: 'Comprovante não encontrado.' });
  res.setHeader('Content-Type', proof.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="comprovante-${proof.id}"; filename*=UTF-8''${encodeURIComponent(proof.fileName).replace(/'/g, '%27')}`,
  );
  return res.send(proof.content);
});

router.get('/comunicados/anexos/:id/arquivo', async (req, res) => {
  const attachment = await prisma.associationPostAttachment.findFirst({
    where: {
      id: positiveInt(Number(req.params.id)),
      post: {
        status: 'PUBLICADO',
        audience: { in: ['ASSOCIADOS', 'TODOS'] },
        publishedAt: { lte: new Date() },
      },
    },
  });
  if (!attachment) return res.status(404).json({ error: 'Anexo não encontrado.' });
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="anexo-${attachment.id}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName).replace(/'/g, '%27')}`,
  );
  return res.send(attachment.content);
});

router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ConflictError) return res.status(409).json({ error: error.message });
  if (error instanceof InputError) return res.status(400).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Já existe um comprovante em análise para esta mensalidade.' });
    }
    if (error.code === 'P2025') return res.status(404).json({ error: 'Registro não encontrado.' });
  }
  console.error(JSON.stringify({ event: 'MEMBER_REQUEST_ERROR' }));
  return res.status(500).json({ error: 'Não foi possível concluir a operação. Tente novamente.' });
});

export default router;
