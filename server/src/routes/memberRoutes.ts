import { Router, Request, Response } from 'express';
import prisma from '../db';
import { validateCPF } from '../utils/cpfValidator';
import { adminAuth } from '../middleware/adminAuth';
import { auditLog } from '../utils/logger';
import { normalizeCpf } from '../utils/normalizeCpf';
import { isCpfInAuthorizedList } from '../utils/authorizedCpfList';

const router = Router();

// Público: checa se CPF está liberado
router.get('/eligibility/:cpf', async (req: Request, res: Response) => {
  try {
    const cleanCpf = normalizeCpf(req.params.cpf || '');

    if (!validateCPF(cleanCpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    // Regra: se já existe cadastro, permitir acesso ao próprio cadastro
    // (mesmo que o CPF não esteja mais na lista oficial)
    const existingCadastro = await prisma.cadastro.findUnique({ where: { cpf: cleanCpf } });
    if (existingCadastro) {
      return res.json({ cpf: cleanCpf, eligible: true, status: 'REGISTERED', hasCadastro: true });
    }

    if (!isCpfInAuthorizedList(cleanCpf)) {
      return res.status(403).json({
        error: 'CPF não faz parte do sistema (não está na lista oficial).',
        code: 'CPF_NOT_IN_SYSTEM',
      });
    }

    const member = await prisma.member.findUnique({ where: { cpf: cleanCpf } });

    if (!member || member.status !== 'ACTIVE') {
      return res.json({
        cpf: cleanCpf,
        eligible: false,
        status: member?.status ?? 'BLOCKED',
        hasCadastro: false,
      });
    }

    return res.json({
      cpf: cleanCpf,
      eligible: true,
      status: member.status,
      unlockedAt: member.unlockedAt,
      hasCadastro: false,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao verificar elegibilidade.' });
  }
});

// Admin: busca status de um CPF
router.get('/admin/members/:cpf', adminAuth, async (req: Request, res: Response) => {
  try {
    const cleanCpf = normalizeCpf(req.params.cpf || '');
    if (!validateCPF(cleanCpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    const inAuthorizedList = isCpfInAuthorizedList(cleanCpf);
    if (!inAuthorizedList) {
      return res.json({
        cpf: cleanCpf,
        status: 'BLOCKED',
        exists: false,
        inAuthorizedList: false,
        warning: 'CPF não faz parte do sistema (não está na lista oficial).',
      });
    }

    const member = await prisma.member.findUnique({ where: { cpf: cleanCpf } });

    if (!member) {
      return res.json({ cpf: cleanCpf, status: 'BLOCKED', exists: false, inAuthorizedList: true });
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
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar associado.' });
  }
});

// Admin: liberar CPF
router.post('/admin/members/unlock', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.body?.cpf || '');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

    if (!validateCPF(cpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    if (!isCpfInAuthorizedList(cpf)) {
      return res.status(403).json({
        error: 'CPF não faz parte do sistema (não está na lista oficial).',
        code: 'CPF_NOT_IN_SYSTEM',
      });
    }

    // Se já estiver liberado, não sobrescrever data/hora de liberação
    const existing = await prisma.member.findUnique({ where: { cpf } });
    if (existing && existing.status === 'ACTIVE') {
      return res.json({ success: true, alreadyActive: true, member: existing });
    }

    const member = await prisma.member.upsert({
      where: { cpf },
      update: {
        status: 'ACTIVE',
        unlockedAt: new Date(),
        unlockedBy: 'admin',
        notes,
      },
      create: {
        cpf,
        status: 'ACTIVE',
        unlockedAt: new Date(),
        unlockedBy: 'admin',
        notes,
      },
    });

    auditLog('MEMBER_UNLOCK', `CPF liberado: ${cpf}`);
    return res.json({ success: true, alreadyActive: false, member });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao liberar CPF.' });
  }
});

// Admin: bloquear CPF
router.post('/admin/members/block', adminAuth, async (req: Request, res: Response) => {
  try {
    const cpf = normalizeCpf(req.body?.cpf || '');
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

    if (!validateCPF(cpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    if (!isCpfInAuthorizedList(cpf)) {
      return res.status(403).json({
        error: 'CPF não faz parte do sistema (não está na lista oficial).',
        code: 'CPF_NOT_IN_SYSTEM',
      });
    }

    const member = await prisma.member.upsert({
      where: { cpf },
      update: {
        status: 'BLOCKED',
        notes,
      },
      create: {
        cpf,
        status: 'BLOCKED',
        notes,
      },
    });

    auditLog('MEMBER_BLOCK', `CPF bloqueado: ${cpf}`);
    return res.json({ success: true, member });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao bloquear CPF.' });
  }
});

export default router;
