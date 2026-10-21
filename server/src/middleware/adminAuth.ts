import type { Request, Response, NextFunction } from 'express';
import { isAdminTokenRevoked, verifyToken } from '../utils/jwt';

export const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }

  const token = authHeader.substring(7);

  const decoded = verifyToken(token);
  if (
    !decoded ||
    decoded.role !== 'admin' ||
    decoded.scope !== 'admin' ||
    isAdminTokenRevoked(decoded)
  ) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
  res.locals.adminToken = decoded;

  next();
};
