import fs from 'node:fs';
import { config } from '../config';

export interface MailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}

// Brevo (API transacional) em produção. "file" e "console" existem só para testes e desenvolvimento
// local e nunca são usados com NODE_ENV=production.
export async function sendMail(message: MailMessage): Promise<boolean> {
  const driver = config.mailDriver;
  const devMail = !config.production || process.env.APP_ENV === 'test';
  try {
    if (driver === 'file' && devMail && config.mailFile) {
      fs.appendFileSync(config.mailFile, `${JSON.stringify(message)}\n`);
      return true;
    }
    if (driver === 'console' && devMail) {
      console.info(`[e-mail de desenvolvimento] para ${message.to}: ${message.text}`);
      return true;
    }
    if (!config.brevoApiKey || !config.mailFromEmail) return false;
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': config.brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: config.mailFromName, email: config.mailFromEmail },
        ...(config.mailReplyTo
          ? { replyTo: { email: config.mailReplyTo, name: config.mailFromName } }
          : {}),
        to: [{ email: message.to, ...(message.toName ? { name: message.toName } : {}) }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '';
  return `${user.slice(0, 1)}${'•'.repeat(Math.min(Math.max(user.length - 1, 3), 6))}@${domain}`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export function activationEmail(
  name: string,
  code: string,
  minutes: number,
): Omit<MailMessage, 'to'> {
  const rawFirst = (name || '').trim().split(/\s+/)[0] || 'associado(a)';
  const first = escapeHtml(rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase());
  const spaced = `${code.slice(0, 4)} ${code.slice(4)}`;
  const text =
    `Olá, ${first}.\n\n` +
    `Você pediu um código para criar a senha do seu acesso ao Portal do Associado da AAFAB — ` +
    `Associação Amigos da Força Aérea Brasileira.\n\n` +
    `Seu código: ${spaced}\n\n` +
    `Ele vale por ${minutes} minutos e só pode ser usado uma vez. Digite-o na tela do portal onde você pediu o código.\n\n` +
    `Se você não fez esse pedido, pode ignorar esta mensagem: sem o código, ninguém consegue acessar a sua conta. ` +
    `A AAFAB nunca pede esse código por telefone, mensagem ou e-mail.\n\n` +
    `Dúvidas? Responda este e-mail que a Secretaria da AAFAB atende você.\n\n` +
    `AAFAB — Associação Amigos da Força Aérea Brasileira\nMensagem automática de segurança.`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Código de acesso — Portal do Associado AAFAB</title></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Seu código de acesso ao Portal do Associado da AAFAB: ${spaced}. Vale por ${minutes} minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#1e3a8a;padding:18px 24px;color:#ffffff"><div style="font-weight:bold;font-size:16px">AAFAB — Portal do Associado</div><div style="font-size:12px;opacity:.85;margin-top:2px">Associação Amigos da Força Aérea Brasileira</div></td></tr>
<tr><td style="padding:28px 24px">
<p style="margin:0 0 12px;font-size:16px">Olá, ${first}.</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5">Você pediu um código para criar a senha do seu acesso ao Portal do Associado.</p>
<p style="margin:0 0 6px;font-size:13px;color:#64748b;text-align:center">Seu código</p>
<p style="margin:0 0 18px;text-align:center;font-size:34px;font-weight:bold;letter-spacing:6px;background:#eff6ff;border-radius:12px;padding:16px;color:#1e3a8a">${spaced}</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.5">Ele vale por <strong>${minutes} minutos</strong> e só pode ser usado uma vez. Digite-o na tela do portal onde você pediu o código.</p>
<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#475569">Se você não fez esse pedido, pode ignorar esta mensagem: sem o código, ninguém consegue acessar a sua conta. A AAFAB nunca pede esse código por telefone, mensagem ou e-mail.</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#475569">Dúvidas? Responda este e-mail que a Secretaria da AAFAB atende você.</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;font-size:11px;color:#94a3b8;text-align:center">AAFAB — Associação Amigos da Força Aérea Brasileira · Mensagem automática de segurança</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: 'Código de acesso — Portal do Associado AAFAB', html, text };
}
