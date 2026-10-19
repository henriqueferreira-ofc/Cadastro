import crypto from 'node:crypto';
import { config } from '../config';

export function generateAccessCode(): string {
  return crypto.randomInt(0, 100_000_000).toString().padStart(8, '0');
}

export function hashAccessCode(cpf: string, code: string): string {
  return crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`registration:${cpf}:${code}`)
    .digest('hex');
}

export function hashPortalActivationCode(cpf: string, code: string): string {
  return crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`portal-activation:${cpf}:${code}`)
    .digest('hex');
}

export function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
