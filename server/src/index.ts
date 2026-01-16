import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cadastroRoutes from './routes/cadastroRoutes';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Rate limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Muitas requisições. Tente novamente em 15 minutos.'
});

app.use(cors());
app.use(express.json());
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cadastro', cadastroRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(port, () => {
    console.log(`🚀 Servidor AAFAB rodando na porta ${port}`);
});
