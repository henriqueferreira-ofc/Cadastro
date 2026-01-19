import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const token = authHeader.substring(7);

  // Modo desenvolvimento: permitir token local para facilitar testes locais
  // (NÃO funciona em produção)
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (isDev && isLocalhost && token === 'local_admin_access') {
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'admin') {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }

  next();
};
