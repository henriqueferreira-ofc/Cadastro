import crypto from 'node:crypto';
const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;

function derive(password: string, salt: Buffer, length: number, parameters: {
  cost: number;
  blockSize: number;
  parallelization: number;
  maxmem: number;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, length, parameters, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return 'A senha deve ter entre 10 e 128 caracteres.';
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return 'A senha deve conter pelo menos uma letra e um número.';
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await derive(password, salt, keyLength, {
    cost,
    blockSize,
    parallelization,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', cost, blockSize, parallelization, salt.toString('hex'), derived.toString('hex')].join(
    '$',
  );
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, rawCost, rawBlockSize, rawParallelization, saltHex, expectedHex] =
    encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    !/^\d+$/.test(rawCost || '') ||
    !/^\d+$/.test(rawBlockSize || '') ||
    !/^\d+$/.test(rawParallelization || '') ||
    !/^[a-f0-9]{32}$/.test(saltHex || '') ||
    !/^[a-f0-9]{128}$/.test(expectedHex || '')
  ) {
    return false;
  }
  const expected = Buffer.from(expectedHex, 'hex');
  const derived = await derive(password, Buffer.from(saltHex, 'hex'), expected.length, {
    cost: Number(rawCost),
    blockSize: Number(rawBlockSize),
    parallelization: Number(rawParallelization),
    maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(derived, expected);
}
