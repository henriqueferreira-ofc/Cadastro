import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const issuer = 'aafab-api';
const audience = 'aafab-web';

export const generateToken = (payload: { role: string }): string => {
  return jwt.sign({ ...payload, scope: 'admin' }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '30m',
    issuer,
    audience,
    jwtid: crypto.randomUUID(),
  });
};

// Tokens administrativos encerrados no logout deixam de valer imediatamente (até expirarem).
const revokedAdminTokens = new Map<string, number>();

export const revokeAdminToken = (payload: jwt.JwtPayload): void => {
  const now = Math.floor(Date.now() / 1000);
  for (const [id, expiresAt] of revokedAdminTokens) {
    if (expiresAt <= now) revokedAdminTokens.delete(id);
  }
  if (payload.jti && payload.exp) revokedAdminTokens.set(payload.jti, payload.exp);
};

export const isAdminTokenRevoked = (payload: jwt.JwtPayload): boolean =>
  !!payload.jti && revokedAdminTokens.has(payload.jti);

export interface AuthTokenPayload extends jwt.JwtPayload {
  role?: string;
  scope?: string;
  memberId?: number;
  cpf?: string;
  codeHash?: string;
  accountId?: number;
  cadastroId?: number;
  sessionVersion?: number;
}

export const generateRegistrationToken = (payload: {
  memberId: number;
  cpf: string;
  codeHash: string;
}): string =>
  jwt.sign({ ...payload, scope: 'registration' }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '15m',
    issuer,
    audience,
  });

export const generateMemberToken = (payload: {
  accountId: number;
  cadastroId: number;
  sessionVersion: number;
}): string =>
  jwt.sign({ ...payload, role: 'member', scope: 'member' }, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '8h',
    issuer,
    audience,
  });

export const verifyToken = (token: string): AuthTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer,
      audience,
    });
    return typeof decoded === 'string' ? null : decoded;
  } catch {
    return null;
  }
};
