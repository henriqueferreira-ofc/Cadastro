import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db';
import { auditLog } from '../utils/logger';
import { validateCPF } from '../utils/cpfValidator';
import { adminAuth } from '../middleware/adminAuth';
import { normalizeCpf } from '../utils/normalizeCpf';
import { verifyToken } from '../utils/jwt';
import { sameHash } from '../utils/registrationCode';

const router = Router();

// Função para limpar dados e manter apenas o que o Prisma espera
const sanitizeCadastro = (data: unknown) => {
  const fields = [
    'cpf',
    'nome',
    'estado',
    'turma_cesd',
    'rg',
    'email',
    'telefone',
    'endereco',
    'bairro',
    'cidade',
    'cep',
    'certidao_obito',
  ];
  const source = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const sanitized: Record<string, string | null> = {};
  fields.forEach((f) => {
    const value = source[f];
    if (value === undefined) return;
    if (value === null && f === 'certidao_obito') sanitized[f] = null;
    else if (typeof value === 'string') sanitized[f] = value.trim();
  });
  return sanitized;
};

const requiredTextFields = [
  'nome',
  'estado',
  'turma_cesd',
  'rg',
  'email',
  'telefone',
  'endereco',
  'bairro',
  'cidade',
  'cep',
] as const;

const fieldLimits: Record<(typeof requiredTextFields)[number], number> = {
  nome: 160,
  estado: 2,
  turma_cesd: 40,
  rg: 40,
  email: 254,
  telefone: 20,
  endereco: 240,
  bairro: 120,
  cidade: 120,
  cep: 9,
};

const bearerToken = (req: Request): string | null => {
  const value = req.headers.authorization;
  return value?.startsWith('Bearer ') ? value.slice(7) : null;
};

// Submissão de novo cadastro (LGPD Compliant)
router.post('/', async (req, res) => {
  try {
    const data = sanitizeCadastro(req.body);

    const token = bearerToken(req);
    const access = token ? verifyToken(token) : null;
    if (
      !access ||
      access.scope !== 'registration' ||
      typeof access.memberId !== 'number' ||
      typeof access.cpf !== 'string' ||
      typeof access.codeHash !== 'string'
    ) {
      return res.status(401).json({ error: 'Acesso de cadastro inválido ou expirado.' });
    }

    const cleanCpf = normalizeCpf(String(data.cpf || ''));

    // Backend CPF validation
    if (!validateCPF(cleanCpf)) {
      return res.status(400).json({ error: 'CPF inválido.' });
    }

    if (cleanCpf !== access.cpf) {
      return res.status(403).json({ error: 'Acesso de cadastro recusado.' });
    }

    for (const field of requiredTextFields) {
      const value = data[field];
      if (typeof value !== 'string' || value.length === 0 || value.length > fieldLimits[field]) {
        return res.status(400).json({ error: 'Revise os campos obrigatórios do formulário.' });
      }
    }
    if (!/^[A-Z]{2}$/i.test(data.estado as string))
      return res.status(400).json({ error: 'Estado inválido.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email as string))
      return res.status(400).json({ error: 'E-mail inválido.' });
    if (!/^\d{10,11}$/.test((data.telefone as string).replace(/\D/g, '')))
      return res.status(400).json({ error: 'Telefone inválido.' });
    if (!/^\d{8}$/.test((data.cep as string).replace(/\D/g, '')))
      return res.status(400).json({ error: 'CEP inválido.' });

    const cadastro = await prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({ where: { id: access.memberId } });
      const accessStillValid =
        member?.cpf === cleanCpf &&
        member.status === 'ACTIVE' &&
        !!member.accessCodeHash &&
        sameHash(member.accessCodeHash, access.codeHash as string) &&
        !!member.accessCodeExpiresAt &&
        member.accessCodeExpiresAt.getTime() > Date.now() &&
        !member.accessCodeUsedAt;

      if (!member || !accessStillValid) throw new Error('REGISTRATION_ACCESS_INVALID');

      const created = await tx.cadastro.create({
        data: {
          cpf: cleanCpf,
          nome: data.nome as string,
          estado: (data.estado as string).toUpperCase(),
          turma_cesd: data.turma_cesd as string,
          rg: data.rg as string,
          email: (data.email as string).toLowerCase(),
          telefone: (data.telefone as string).replace(/\D/g, ''),
          endereco: data.endereco as string,
          bairro: data.bairro as string,
          cidade: data.cidade as string,
          cep: (data.cep as string).replace(/\D/g, ''),
          certidao_obito:
            typeof data.certidao_obito === 'string' ? data.certidao_obito.slice(0, 240) : null,
          status: 'CONCLUÍDO',
        },
      });
      await tx.member.update({
        where: { id: member.id },
        data: {
          accessCodeHash: null,
          accessCodeExpiresAt: null,
          accessCodeUsedAt: new Date(),
        },
      });
      return created;
    });

    auditLog('REGISTRATION_CREATED', 'Novo cadastro concluído');
    return res.status(201).json({ success: true, data: { id: cadastro.id, cpf: cadastro.cpf } });
  } catch (error) {
    if (error instanceof Error && error.message === 'REGISTRATION_ACCESS_INVALID') {
      return res.status(401).json({ error: 'Acesso de cadastro inválido ou expirado.' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'Este cadastro já foi concluído.' });
    }
    res.status(500).json({ error: 'Erro ao processar cadastro no servidor.' });
  }
});

// Listagem Admin (com autorização)
router.get('/admin/list', adminAuth, async (req, res) => {
  try {
    auditLog('ADMIN_LIST', 'Listagem de cadastros acessada');
    const cadastros = await prisma.cadastro.findMany({
      orderBy: { data_envio: 'desc' },
    });
    res.json(cadastros);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar cadastros.' });
  }
});

// Buscar cadastro por CPF (sem autenticação - apenas consulta pessoal)
router.get('/consulta/:cpf', (_req: Request, res: Response) =>
  res.status(410).json({
    error: 'A consulta pública foi desativada. Procure a Secretaria da AAFAB.',
    code: 'PUBLIC_LOOKUP_DISABLED',
  }),
);

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

// Exportação CSV compatível com Excel, sem uma biblioteca vulnerável de planilhas.
router.get('/admin/export', adminAuth, async (req, res) => {
  try {
    auditLog('ADMIN_EXPORT', 'Exportação para Excel solicitada');
    const cadastros = await prisma.cadastro.findMany({
      orderBy: { data_envio: 'desc' },
    });

    const header = [
      'CPF',
      'NOME',
      'EMAIL',
      'TELEFONE',
      'ESTADO',
      'BAIRRO',
      'CIDADE',
      'ENDEREÇO',
      'TURMA',
      'CERTIDÃO DE ÓBITO',
      'DATA ENVIO',
    ];
    const rows = cadastros.map((c) =>
      [
        c.cpf,
        c.nome,
        c.email,
        c.telefone,
        c.estado,
        c.bairro,
        c.cidade,
        c.endereco,
        c.turma_cesd,
        c.certidao_obito || '',
        c.data_envio.toLocaleString('pt-BR'),
      ]
        .map(csvCell)
        .join(';'),
    );
    const csv = `\uFEFF${[header.map(csvCell).join(';'), ...rows].join('\r\n')}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cadastros_aafab.csv"');
    return res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Erro na exportação.' });
  }
});

export default router;
