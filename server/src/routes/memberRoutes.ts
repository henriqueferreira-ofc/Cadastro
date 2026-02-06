import { Router, Request, Response } from 'express';
import prisma from '../db';
import { validateCPF } from '../utils/cpfValidator';
import { adminAuth } from '../middleware/adminAuth';
import { auditLog } from '../utils/logger';
import { normalizeCpf } from '../utils/normalizeCpf';
import { isCpfInAuthorizedList } from '../utils/authorizedCpfList';
import { EXCLUDED_CPF_MESSAGE, isCpfExcluded } from '../utils/excludedCpfs';

const router = Router();

// Público: checa se CPF está liberado
router.get('/eligibility/:cpf', async (req: Request, res: Response) => {
  try {
    const cleanCpf = normalizeCpf(req.params.cpf || '');

    if (!validateCPF(cleanCpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    if (isCpfExcluded(cleanCpf)) {
      return res.status(403).json({
        error: EXCLUDED_CPF_MESSAGE,
        code: 'CPF_EXCLUDED',
      });
    }

    // Regra: se já existe cadastro, permitir acesso ao próprio cadastro
    // (mesmo que o CPF não esteja mais na lista oficial)
    const existingCadastro = await prisma.cadastro.findUnique({ where: { cpf: cleanCpf } });
    if (existingCadastro) {
      return res.json({ cpf: cleanCpf, eligible: true, status: 'REGISTERED', hasCadastro: true });
    }

    // CPFs importados pelo admin entram como Member (BLOCKED) e devem ser tratados como "no sistema"
    const member = await prisma.member.findUnique({ where: { cpf: cleanCpf } });
    const inAuthorizedList = isCpfInAuthorizedList(cleanCpf);

    // Se não está na lista oficial e não existe no banco (Member), então não faz parte do sistema
    if (!inAuthorizedList && !member) {
      return res.status(403).json({
        error: 'CPF não faz parte do sistema (não está na lista AAFAB).',
        code: 'CPF_NOT_IN_SYSTEM',
      });
    }

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

    if (isCpfExcluded(cleanCpf)) {
      return res.json({
        cpf: cleanCpf,
        status: 'BLOCKED',
        exists: false,
        inAuthorizedList: false,
        warning: EXCLUDED_CPF_MESSAGE,
      });
    }

    const inAuthorizedList = isCpfInAuthorizedList(cleanCpf);
    const member = await prisma.member.findUnique({ where: { cpf: cleanCpf } });

    // Se não está na lista oficial e não existe Member, então não faz parte do sistema
    if (!inAuthorizedList && !member) {
      return res.json({
        cpf: cleanCpf,
        status: 'BLOCKED',
        exists: false,
        inAuthorizedList: false,
        warning: 'CPF não faz parte do sistema (não está na lista AAFAB).',
      });
    }

    if (!member) {
      // Está na lista oficial, mas ainda não tem registro Member (fica bloqueado)
      return res.json({ cpf: cleanCpf, status: 'BLOCKED', exists: false, inAuthorizedList: true });
    }

    return res.json({
      cpf: member.cpf,
      status: member.status,
      exists: true,
      // Para o admin, treat "inAuthorizedList" como "no sistema" (lista oficial OU importado)
      // para permitir liberação/bloqueio.
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

// Admin: importar CPFs para o sistema como BLOCKED (para seguir o fluxo de liberação)
router.post('/admin/members/import', adminAuth, async (req: Request, res: Response) => {
  try {
    const bodyCpfs = (req.body as any)?.cpfs;

    const rawList: string[] = Array.isArray(bodyCpfs)
      ? bodyCpfs
      : typeof bodyCpfs === 'string'
        ? bodyCpfs.split(/[\n,;\s]+/)
        : [];

    const normalized: string[] = [];
    const seen = new Set<string>();
    let invalid = 0;
    let excluded = 0;

    for (const item of rawList) {
      const clean = normalizeCpf(String(item || ''));
      if (!validateCPF(clean)) {
        invalid += 1;
        continue;
      }
      if (isCpfExcluded(clean)) {
        excluded += 1;
        continue;
      }
      if (seen.has(clean)) continue;
      seen.add(clean);
      normalized.push(clean);
    }

    if (normalized.length === 0) {
      return res.json({ success: true, imported: 0, invalid, excluded });
    }

    const result = await prisma.member.createMany({
      data: normalized.map((cpf) => ({
        cpf,
        status: 'BLOCKED',
        notes: 'IMPORTADO VIA ADMIN',
      })),
      skipDuplicates: true,
    });

    auditLog('MEMBER_IMPORT', `Importação de CPFs: ${result.count} novos (entrada: ${normalized.length})`);
    return res.json({
      success: true,
      imported: result.count,
      received: normalized.length,
      invalid,
      excluded,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao importar CPFs.' });
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

    if (isCpfExcluded(cpf)) {
      return res.status(403).json({
        error: EXCLUDED_CPF_MESSAGE,
        code: 'CPF_EXCLUDED',
      });
    }

    const inAuthorizedList = isCpfInAuthorizedList(cpf);
    const existing = await prisma.member.findUnique({ where: { cpf } });
    const inSystem = inAuthorizedList || Boolean(existing);
    if (!inSystem) {
      return res.status(403).json({
        error: 'CPF não faz parte do sistema (não está na lista AAFAB).',
        code: 'CPF_NOT_IN_SYSTEM',
      });
    }

    // Se já estiver liberado, não sobrescrever data/hora de liberação
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

    if (isCpfExcluded(cpf)) {
      return res.status(403).json({
        error: EXCLUDED_CPF_MESSAGE,
        code: 'CPF_EXCLUDED',
      });
    }

    const inAuthorizedList = isCpfInAuthorizedList(cpf);
    const existing = await prisma.member.findUnique({ where: { cpf } });
    const inSystem = inAuthorizedList || Boolean(existing);
    if (!inSystem) {
      return res.status(403).json({
        error: 'CPF não faz parte do sistema (não está na lista AAFAB).',
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
