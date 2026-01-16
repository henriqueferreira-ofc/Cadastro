import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cadastroRoutes from './routes/cadastroRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/cadastro', cadastroRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(port, () => {
    console.log(`🚀 Servidor AAFAB rodando na porta ${port}`);
});
