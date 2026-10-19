import type { Request, Response, NextFunction } from 'express';
import prisma from '../db';
import { verifyToken } from '../utils/jwt';

export type MemberAuthContext = {
  accountId: number;
  cadastroId: number;
};

export async function memberAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sessão não fornecida.' });
  }
  const decoded = verifyToken(authHeader.slice(7));
  if (
    !decoded ||
    decoded.role !== 'member' ||
    decoded.scope !== 'member' ||
    !Number.isSafeInteger(decoded.accountId) ||
    !Number.isSafeInteger(decoded.cadastroId) ||
    !Number.isSafeInteger(decoded.sessionVersion)
  ) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
  const account = await prisma.memberAccount.findUnique({
    where: { id: decoded.accountId },
    select: {
      cadastroId: true,
      sessionVersion: true,
      passwordHash: true,
      cadastro: { select: { cpf: true } },
    },
  });
  const member = account
    ? await prisma.member.findUnique({ where: { cpf: account.cadastro.cpf }, select: { status: true } })
    : null;
  if (
    !account?.passwordHash ||
    member?.status !== 'ACTIVE' ||
    account.cadastroId !== decoded.cadastroId ||
    account.sessionVersion !== decoded.sessionVersion
  ) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
  res.locals.memberAuth = {
    accountId: decoded.accountId!,
    cadastroId: decoded.cadastroId!,
  } satisfies MemberAuthContext;
  next();
}
