import { Router, Request, Response } from 'express';
import prisma from '../db';
import ExcelJS from 'exceljs';
import { auditLog } from '../utils/logger';
import { verifyToken } from '../utils/jwt';
import { validateCPF } from '../utils/cpfValidator';

const router = Router();

// Middleware para autorização administrativa com JWT
const adminAuth = (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido.' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded || decoded.role !== 'admin') {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    next();
};

// Função para limpar dados e manter apenas o que o Prisma espera
const sanitizeCadastro = (data: any) => {
    const fields = [
        'cpf', 'nome', 'estado', 'turma_cesd', 'rg',
        'email', 'telefone', 'endereco', 'bairro', 'cidade', 'cep', 'certidao_obito'
    ];
    const sanitized: any = {};
    fields.forEach(f => {
        if (data[f] !== undefined) sanitized[f] = data[f];
    });
    return sanitized;
};

// Submissão de novo cadastro (LGPD Compliant)
router.post('/', async (req, res) => {
    try {
        const data = sanitizeCadastro(req.body);

        if (!data.cpf) {
            return res.status(400).json({ error: 'CPF é obrigatório.' });
        }

        // Backend CPF validation
        if (!validateCPF(data.cpf)) {
            return res.status(400).json({ error: 'CPF inválido.' });
        }

        // Upsert logic to guarantee uniqueness by CPF
        const cadastro = await prisma.cadastro.upsert({
            where: { cpf: data.cpf },
            update: {
                ...data,
                data_envio: new Date(),
                status: 'CONCLUÍDO'
            },
            create: {
                ...data,
                status: 'CONCLUÍDO'
            }
        });

        res.json({ success: true, data: cadastro });
    } catch (error) {
        console.error('Erro ao salvar:', error);
        res.status(500).json({ error: 'Erro ao processar cadastro no servidor.' });
    }
});

// Listagem Admin (com autorização)
router.get('/admin/list', adminAuth, async (req, res) => {
    try {
        auditLog('ADMIN_LIST', 'Listagem de cadastros acessada');
        const cadastros = await prisma.cadastro.findMany({
            orderBy: { data_envio: 'desc' }
        });
        res.json(cadastros);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar cadastros.' });
    }
});

// Exportar para Excel
router.get('/admin/export', adminAuth, async (req, res) => {
    try {
        auditLog('ADMIN_EXPORT', 'Exportação para Excel solicitada');
        const cadastros = await prisma.cadastro.findMany({
            orderBy: { data_envio: 'desc' }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Cadastros AAFAB');

        worksheet.columns = [
            { header: 'CPF', key: 'cpf', width: 15 },
            { header: 'Nome', key: 'nome', width: 30 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Telefone', key: 'telefone', width: 15 },
            { header: 'Estado', key: 'estado', width: 10 },
            { header: 'Bairro', key: 'bairro', width: 15 },
            { header: 'Cidade', key: 'cidade', width: 15 },
            { header: 'Endereço', key: 'endereco', width: 40 },
            { header: 'Turma', key: 'turma_cesd', width: 15 },
            { header: 'Certidão de Óbito', key: 'certidao_obito', width: 20 },
            { header: 'Data Envio', key: 'data_envio', width: 20 },
        ];

        cadastros.forEach(c => {
            worksheet.addRow({
                ...c,
                data_envio: c.data_envio.toLocaleString()
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="cadastros_aafab.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: 'Erro na exportação.' });
    }
});

export default router;
