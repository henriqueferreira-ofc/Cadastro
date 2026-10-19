import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import prisma from '../db';
import { config } from '../config';
import { generateRegistrationToken, generateToken } from '../utils/jwt';
import { auditLog } from '../utils/logger';
import { normalizeCpf } from '../utils/normalizeCpf';
import { validateCPF } from '../utils/cpfValidator';
import { hashAccessCode, sameHash } from '../utils/registrationCode';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Admin login endpoint
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (typeof password !== 'string' || password.length > 200) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const provided = crypto.createHash('sha256').update(password).digest();
  const expected = crypto.createHash('sha256').update(config.adminPassword).digest();
  if (crypto.timingSafeEqual(provided, expected)) {
    const token = generateToken({ role: 'admin' });
    auditLog('ADMIN_LOGIN', 'Login administrativo bem-sucedido');

    return res.json({
      success: true,
      token,
      expiresIn: '30m',
    });
  }

  auditLog('ADMIN_LOGIN_FAILED', 'Tentativa administrativa recusada');
  return res.status(401).json({ error: 'Credenciais inválidas.' });
});

const genericAccessMessage =
  'Não foi possível iniciar o cadastro. Solicite orientação à Secretaria da AAFAB.';

// Orienta o fluxo sem devolver nome, situação financeira ou qualquer outro dado pessoal.
router.post('/registration-guidance', async (req: Request, res: Response) => {
  const cpf = normalizeCpf(req.body?.cpf);
  if (!validateCPF(cpf)) {
    return res.status(200).json({ status: 'CONTACT_SECRETARY' });
  }
  try {
    const [member, cadastro] = await Promise.all([
      prisma.member.findUnique({
        where: { cpf },
        select: {
          status: true,
          accessCodeHash: true,
          accessCodeExpiresAt: true,
          accessCodeUsedAt: true,
        },
      }),
      prisma.cadastro.findUnique({ where: { cpf }, select: { id: true } }),
    ]);
    if (!member) {
      auditLog('REGISTRATION_GUIDANCE_DENIED', 'CPF não confirmado no fluxo público');
      return res.json({ status: 'CONTACT_SECRETARY' });
    }
    if (cadastro) {
      return res.json({
        status: member.status === 'ACTIVE' ? 'ALREADY_REGISTERED' : 'CONTACT_SECRETARY',
      });
    }
    const codeAvailable =
      member.status === 'ACTIVE' &&
      !!member.accessCodeHash &&
      !!member.accessCodeExpiresAt &&
      !member.accessCodeUsedAt &&
      member.accessCodeExpiresAt.getTime() > Date.now();
    if (codeAvailable) return res.json({ status: 'CODE_READY' });
    if (member.status === 'ACTIVE') return res.json({ status: 'CONTACT_SECRETARY' });
    return res.json({ status: 'PAYMENT_REQUIRED' });
  } catch {
    return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
});

// Primeiro cadastro: exige CPF e o código temporário fornecido pela administração.
router.post('/registration-access', async (req: Request, res: Response) => {
  const cpf = normalizeCpf(req.body?.cpf);
  const accessCode = String(req.body?.accessCode || '').replace(/\D/g, '');

  if (!validateCPF(cpf) || !/^\d{8}$/.test(accessCode)) {
    return res.status(200).json({ eligible: false, message: genericAccessMessage });
  }

  try {
    const [member, cadastro] = await Promise.all([
      prisma.member.findUnique({ where: { cpf } }),
      prisma.cadastro.findUnique({ where: { cpf }, select: { id: true } }),
    ]);
    const suppliedHash = hashAccessCode(cpf, accessCode);
    const codeIsValid =
      member?.status === 'ACTIVE' &&
      !cadastro &&
      !!member.accessCodeHash &&
      !!member.accessCodeExpiresAt &&
      !member.accessCodeUsedAt &&
      member.accessCodeExpiresAt.getTime() > Date.now() &&
      sameHash(member.accessCodeHash, suppliedHash);

    if (!member || !codeIsValid) {
      auditLog('REGISTRATION_ACCESS_DENIED', 'Solicitação de cadastro recusada');
      return res.status(200).json({ eligible: false, message: genericAccessMessage });
    }

    const registrationToken = generateRegistrationToken({
      memberId: member.id,
      cpf,
      codeHash: suppliedHash,
    });
    auditLog('REGISTRATION_ACCESS_GRANTED', 'Código temporário validado');
    return res.json({ eligible: true, registrationToken });
  } catch {
    return res.status(503).json({ error: 'Serviço temporariamente indisponível.' });
  }
});

export default router;
