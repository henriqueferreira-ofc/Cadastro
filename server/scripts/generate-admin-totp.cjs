// Gera a chave do segundo fator do administrador. Execute localmente: npm run admin:totp
// A chave aparece somente neste terminal. Guarde-a no aplicativo autenticador e na variável
// ADMIN_TOTP_SECRET do serviço de hospedagem; nunca no repositório.
const crypto = require('node:crypto');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let bits = '';
for (const byte of crypto.randomBytes(20)) bits += byte.toString(2).padStart(8, '0');
let secret = '';
for (let i = 0; i + 5 <= bits.length; i += 5) secret += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
const uri = `otpauth://totp/AAFAB%20Admin?secret=${secret}&issuer=AAFAB&digits=6&period=30`;
console.log('\nChave do autenticador (digite no app em "Inserir chave de configuração"):\n');
console.log('  ' + secret.match(/.{1,4}/g).join(' '));
console.log('\nVariável para o Render (Environment):\n');
console.log('  ADMIN_TOTP_SECRET=' + secret);
console.log('\nLink otpauth (alternativa, para gerar QR em um gerador offline):\n  ' + uri + '\n');
