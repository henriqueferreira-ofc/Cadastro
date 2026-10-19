import { Router, Request, Response } from 'express';
import prisma from '../db';
import { validateCPF } from '../utils/cpfValidator';
import { adminAuth } from '../middleware/adminAuth';
import { auditLog } from '../utils/logger';
import { normalizeCpf } from '../utils/normalizeCpf';
import {
  generateAccessCode,
  hashAccessCode,
  hashPortalActivationCode,
} from '../utils/registrationCode';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const codeLifetimeMs = 24 * 60 * 60 * 1000;

const publicMember = (member: {
  cpf: string;
  status: string;
  unlockedAt: Date | null;
  unlockedBy: string | null;
  notes: string | null;
  updatedAt: Date;
}) => ({
  cpf: member.cpf,
  status: member.status,
  unlockedAt: member.unlockedAt,
  unlockedBy: member.unlockedBy,
  notes: member.notes,
  updatedAt: member.updatedAt,
});

// Compatibilidade temporária: a consulta antiga não expõe situação nem dados pessoais.
router.get('/eligibility/:cpf', (_req: Request, res: Response) =>
  res.status(410).json({
    error: 'Use o acesso seguro com CPF e código temporário fornecido pela AAFAB.',
    code: 'SECURE_ACCESS_REQUIRED',
  }),
);

router.get('/admin/members', adminAuth, async (_req: Request, res: Response) => {
  try {
    const [members, cadastros] = await Promise.all([
      prisma.member.findMany({ orderBy: { cpf: 'asc' }, take: 5000 }),
      prisma.cadastro.findMany({
        select: { cpf: true, nome: true, estado: true, turma_cesd: true, rg: true },
      }),
    ]);
    const cadastroByCpf = new Map(cadastros.map((cadastro) => [cadastro.cpf, cadastro]));
    return res.json(
      members.map((member) => {
        const cadastro = cadastroByCpf.get(member.cpf);
        return {
          cpf: member.cpf,
          nome: cadastro?.nome || 'AUTORIZAÇÃO SEM CADASTRO',
          estado: cadastro?.estado || '',
          turma_cesd: cadastro?.turma_cesd || '',
          rg: cadastro?.rg || '',
          cadastro_realizado: !!cadastro,
          status: member.status,
        };
      }),
    );
  } catch {
    return res.status(500).json({ error: 'Erro ao listar autorizações.' });
  }
});

router.get('/admin/members/:cpf', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.params.cpf || '');
    if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido.' });
    const [member, cadastro] = await Promise.all([
      prisma.member.findUnique({ where: { cpf } }),
      prisma.cadastro.findUnique({
        where: { cpf },
        select: {
          id: true,
          account: {
            select: {
              passwordHash: true,
              activationCodeHash: true,
              activationCodeExpiresAt: true,
              activationCodeUsedAt: true,
            },
          },
        },
      }),
    ]);
    if (!member) {
      return res.json({
        cpf,
        status: 'BLOCKED',
        exists: false,
        inAuthorizedList: false,
        warning: 'CPF não cadastrado na base de autorizações da AAFAB.',
      });
    }
    return res.json({
      cpf: member.cpf,
      status: member.status,
      exists: true,
      inAuthorizedList: true,
      unlockedAt: member.unlockedAt,
      unlockedBy: member.unlockedBy,
      notes: member.notes,
      updatedAt: member.updatedAt,
      cadastroRealizado: !!cadastro,
      portalAtivo: !!cadastro?.account?.passwordHash,
      ativacaoPortalDisponivel:
        !!cadastro?.account?.activationCodeHash &&
        !cadastro.account.activationCodeUsedAt &&
        !!cadastro.account.activationCodeExpiresAt &&
        cadastro.account.activationCodeExpiresAt.getTime() > Date.now(),
      accessCodeAvailable:
        !!member.accessCodeHash &&
        !member.accessCodeUsedAt &&
        !!member.accessCodeExpiresAt &&
        member.accessCodeExpiresAt.getTime() > Date.now(),
    });
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar autorização.' });
  }
});

router.post('/admin/members/import', adminAuth, async (req: Request, res: Response) => {
  try {
    const bodyCpfs = req.body?.cpfs;
    const rawList: string[] = Array.isArray(bodyCpfs)
      ? bodyCpfs
      : typeof bodyCpfs === 'string'
        ? bodyCpfs.split(/[\n,;\s]+/)
        : [];
    const normalized = [...new Set(rawList.map((item) => normalizeCpf(String(item))))].filter(
      validateCPF,
    );
    const invalid = rawList.length - normalized.length;
    const result = await prisma.member.createMany({
      data: normalized.map((cpf) => ({ cpf, status: 'BLOCKED', notes: 'IMPORTADO VIA ADMIN' })),
      skipDuplicates: true,
    });
    auditLog('MEMBER_IMPORT', `${result.count} autorizações incluídas`);
    return res.json({
      success: true,
      imported: result.count,
      received: normalized.length,
      invalid,
    });
  } catch {
    return res.status(500).json({ error: 'Erro ao importar autorizações.' });
  }
});

router.post('/admin/members/unlock', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.body?.cpf || '');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 2000) : '';
    if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido.' });
    const existing = await prisma.member.findUnique({ where: { cpf } });
    if (!existing)
      return res.status(404).json({ error: 'CPF não cadastrado na base de autorizações.' });
    if (existing.status === 'ACTIVE') {
      const cadastro = await prisma.cadastro.findUnique({ where: { cpf }, select: { id: true } });
      if (cadastro) {
        return res.json({
          success: true,
          alreadyActive: true,
          alreadyRegistered: true,
          member: publicMember(existing),
        });
      }

      const accessCode = generateAccessCode();
      const member = await prisma.member.update({
        where: { cpf },
        data: {
          notes: notes || existing.notes,
          accessCodeHash: hashAccessCode(cpf, accessCode),
          accessCodeExpiresAt: new Date(Date.now() + codeLifetimeMs),
          accessCodeUsedAt: null,
        },
      });
      auditLog('REGISTRATION_CODE_ISSUED', 'Código temporário renovado para CPF liberado');
      return res.json({
        success: true,
        alreadyActive: true,
        member: publicMember(member),
        accessCode,
        expiresIn: '24h',
      });
    }

    const accessCode = generateAccessCode();
    const member = await prisma.member.update({
      where: { cpf },
      data: {
        status: 'ACTIVE',
        unlockedAt: new Date(),
        unlockedBy: 'admin',
        notes,
        accessCodeHash: hashAccessCode(cpf, accessCode),
        accessCodeExpiresAt: new Date(Date.now() + codeLifetimeMs),
        accessCodeUsedAt: null,
      },
    });
    auditLog('MEMBER_UNLOCK', 'CPF liberado e código temporário emitido');
    return res.json({
      success: true,
      alreadyActive: false,
      member: publicMember(member),
      accessCode,
      expiresIn: '24h',
    });
  } catch {
    return res.status(500).json({ error: 'Erro ao liberar CPF.' });
  }
});

router.post('/admin/members/access-code', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.body?.cpf || '');
    if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido.' });
    const member = await prisma.member.findUnique({ where: { cpf } });
    const cadastro = await prisma.cadastro.findUnique({ where: { cpf }, select: { id: true } });
    if (!member || member.status !== 'ACTIVE')
      return res
        .status(409)
        .json({ error: 'O CPF precisa estar liberado antes de gerar o código.' });
    if (cadastro)
      return res
        .status(409)
        .json({ error: 'Este CPF já possui cadastro e não usa o código inicial.' });

    const accessCode = generateAccessCode();
    await prisma.member.update({
      where: { cpf },
      data: {
        accessCodeHash: hashAccessCode(cpf, accessCode),
        accessCodeExpiresAt: new Date(Date.now() + codeLifetimeMs),
        accessCodeUsedAt: null,
      },
    });
    auditLog('REGISTRATION_CODE_ISSUED', 'Novo código temporário emitido');
    return res.json({ success: true, accessCode, expiresIn: '24h' });
  } catch {
    return res.status(500).json({ error: 'Erro ao gerar código temporário.' });
  }
});

router.post('/admin/members/portal-access', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.body?.cpf || '');
    if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido.' });
    const [member, cadastro] = await Promise.all([
      prisma.member.findUnique({ where: { cpf }, select: { status: true } }),
      prisma.cadastro.findUnique({
        where: { cpf },
        include: { account: { select: { id: true, passwordHash: true } } },
      }),
    ]);
    if (!cadastro)
      return res.status(409).json({ error: 'Este CPF ainda precisa concluir o cadastro.' });
    if (member?.status !== 'ACTIVE')
      return res.status(409).json({ error: 'O acesso associativo precisa estar liberado.' });
    const accessCode = generateAccessCode();
    await prisma.memberAccount.upsert({
      where: { cadastroId: cadastro.id },
      create: {
        cadastroId: cadastro.id,
        activationCodeHash: hashPortalActivationCode(cpf, accessCode),
        activationCodeExpiresAt: new Date(Date.now() + codeLifetimeMs),
      },
      update: {
        activationCodeHash: hashPortalActivationCode(cpf, accessCode),
        activationCodeExpiresAt: new Date(Date.now() + codeLifetimeMs),
        activationCodeUsedAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    auditLog(
      cadastro.account?.passwordHash
        ? 'MEMBER_PORTAL_PASSWORD_RESET_ISSUED'
        : 'MEMBER_PORTAL_ACTIVATION_ISSUED',
      cadastro.account?.passwordHash
        ? 'Código de redefinição do portal emitido'
        : 'Código de ativação do portal emitido',
    );
    return res.json({
      success: true,
      accessCode,
      expiresIn: '24h',
      purpose: cadastro.account?.passwordHash ? 'PASSWORD_RESET' : 'ACTIVATION',
    });
  } catch {
    return res.status(500).json({ error: 'Erro ao gerar acesso ao Portal do Associado.' });
  }
});

router.post('/admin/members/block', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.body?.cpf || '');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 2000) : '';
    if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido.' });
    const existing = await prisma.member.findUnique({ where: { cpf } });
    if (!existing)
      return res.status(404).json({ error: 'CPF não cadastrado na base de autorizações.' });
    const member = await prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
        where: { cpf },
        data: {
          status: 'BLOCKED',
          notes,
          accessCodeHash: null,
          accessCodeExpiresAt: null,
          accessCodeUsedAt: null,
        },
      });
      const cadastro = await tx.cadastro.findUnique({ where: { cpf }, select: { id: true } });
      if (cadastro) {
        await tx.memberAccount.updateMany({
          where: { cadastroId: cadastro.id },
          data: {
            sessionVersion: { increment: 1 },
            activationCodeHash: null,
            activationCodeExpiresAt: null,
            activationCodeUsedAt: null,
          },
        });
      }
      return updated;
    });
    auditLog('MEMBER_BLOCK', 'Acesso cadastral bloqueado');
    return res.json({ success: true, member: publicMember(member) });
  } catch {
    return res.status(500).json({ error: 'Erro ao bloquear CPF.' });
  }
});

export default router;
