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
  });
};

export interface AuthTokenPayload extends jwt.JwtPayload {
  role?: string;
  scope?: string;
  memberId?: number;
  cpf?: string;
  codeHash?: string;
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
