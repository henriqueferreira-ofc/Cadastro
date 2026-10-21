import 'dotenv/config';
import { isValidTotpSecret } from './utils/totp';

function required(name: string, minimumLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} deve ser configurado com pelo menos ${minimumLength} caracteres.`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const defaultOrigins =
  nodeEnv === 'production'
    ? ['https://aafab.com.br', 'https://www.aafab.com.br']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

export const config = {
  nodeEnv,
  production: nodeEnv === 'production',
  port: Number(process.env.PORT || 3001),
  databaseUrl: required('DATABASE_URL'),
  adminPassword: required('ADMIN_PASSWORD', 16),
  jwtSecret: required('JWT_SECRET', 32),
  // Opcional, mas recomendado: exige o código do aplicativo autenticador no login do admin.
  adminTotpSecret: (process.env.ADMIN_TOTP_SECRET || '').replace(/\s+/g, '').toUpperCase(),
  corsOrigins: (process.env.CORS_ORIGINS || defaultOrigins.join(','))
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
};

if (config.adminTotpSecret && !isValidTotpSecret(config.adminTotpSecret)) {
  throw new Error('ADMIN_TOTP_SECRET inválido: use a chave gerada por npm run admin:totp.');
}

if (!Number.isSafeInteger(config.port) || config.port < 0 || config.port > 65535) {
  throw new Error('PORT inválida.');
}
