import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cadastroRoutes from './routes/cadastroRoutes';
import authRoutes from './routes/authRoutes';
import memberRoutes from './routes/memberRoutes';
import { config } from './config';
import managementRoutes from './routes/managementRoutes';
import portalRoutes from './routes/portalRoutes';
import { adminAuth } from './middleware/adminAuth';
import { memberAuth } from './middleware/memberAuth';

const app = express();
app.disable('x-powered-by');
if (config.production) app.set('trust proxy', 1);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde alguns minutos.' },
});
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
});
const registrationAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  }),
);
app.use(limiter);
// Os anexos só são recebidos depois da autenticação; o limite padrão permanece nas demais rotas.
app.use('/api/gestao', adminAuth, express.json({ limit: '8mb' }), managementRoutes);
app.use('/api/member/finance/proofs', memberAuth, express.json({ limit: '8mb' }));
app.use('/api/member/secretaria/exemption-requests', memberAuth, express.json({ limit: '8mb' }));
app.use(express.json({ limit: '64kb' }));
app.use('/api/auth/login', adminLoginLimiter);
app.use('/api/auth/registration-access', registrationAccessLimiter);
app.use('/api/auth/registration-guidance', registrationAccessLimiter);
app.use('/api/member/login', adminLoginLimiter);
app.use('/api/member/activate', registrationAccessLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', memberRoutes);
app.use('/api/cadastro', cadastroRoutes);
app.use('/api/member', portalRoutes);

app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

app.use(
  (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Requisição inválida.' });
    }
    console.error(JSON.stringify({ event: 'UNHANDLED_REQUEST_ERROR' }));
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  },
);

const server = app.listen(config.port, () => {
  const address = server.address();
  const listeningPort = typeof address === 'object' && address ? address.port : config.port;
  console.log(`Servidor AAFAB iniciado na porta ${listeningPort}`);
});
