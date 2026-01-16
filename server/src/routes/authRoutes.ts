import { Router, Request, Response } from 'express';
import { generateToken } from '../utils/jwt';
import { auditLog } from '../utils/logger';

const router = Router();

// Admin login endpoint
router.post('/login', (req: Request, res: Response) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ error: 'Senha é obrigatória.' });
    }

    // Validate password against environment variable
    if (password === process.env.ADMIN_PASSWORD) {
        const token = generateToken({ role: 'admin' });
        auditLog('ADMIN_LOGIN', 'Login administrativo bem-sucedido');

        return res.json({
            success: true,
            token,
            expiresIn: '24h'
        });
    }

    auditLog('ADMIN_LOGIN_FAILED', 'Tentativa de login com senha incorreta');
    return res.status(401).json({ error: 'Senha incorreta.' });
});

export default router;
