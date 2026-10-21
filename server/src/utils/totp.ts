import crypto from 'node:crypto';

// TOTP (RFC 6238): código de 6 dígitos a cada 30 s, compatível com Google Authenticator,
// Microsoft Authenticator, Authy e 1Password.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let secret = '';
  for (let index = 0; index + 5 <= bits.length; index += 5) {
    secret += ALPHABET[parseInt(bits.slice(index, index + 5), 2)];
  }
  return secret;
}

function base32Decode(secret: string): Buffer {
  let bits = '';
  for (const char of secret.replace(/=+$/, '')) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Segredo TOTP inválido.');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function codeFor(key: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = crypto.createHmac('sha1', key).update(message).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const value =
    ((hash[offset] & 0x7f) << 24) |
    (hash[offset + 1] << 16) |
    (hash[offset + 2] << 8) |
    hash[offset + 3];
  return String(value % 1_000_000).padStart(6, '0');
}

export function isValidTotpSecret(secret: string): boolean {
  return /^[A-Z2-7]{16,}$/.test(secret);
}

export function totpNow(secret: string, now = Date.now()): string {
  return codeFor(base32Decode(secret), Math.floor(now / 1000 / STEP_SECONDS));
}

let lastAcceptedCounter = -1;

// Aceita a janela atual e uma vizinha (relógios levemente diferentes) e nunca reutiliza um código.
export function verifyTotp(secret: string, code: string, now = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secret);
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  const supplied = Buffer.from(code);
  for (const counter of [current - 1, current, current + 1]) {
    const expected = Buffer.from(codeFor(key, counter));
    if (crypto.timingSafeEqual(supplied, expected) && counter > lastAcceptedCounter) {
      lastAcceptedCounter = counter;
      return true;
    }
  }
  return false;
}
