import { Router, Request, Response } from 'express';
import prisma from '../db';
import ExcelJS from 'exceljs';
import { auditLog } from '../utils/logger';
import { validateCPF } from '../utils/cpfValidator';
import { adminAuth } from '../middleware/adminAuth';

const router = Router();

const normalizeCpf = (cpf: string | string[] | undefined) => {
    const value = Array.isArray(cpf) ? cpf[0] : cpf;
    return (value || '').replace(/\D/g, '');
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

        const cleanCpf = normalizeCpf(data.cpf);

        // Backend CPF validation
        if (!validateCPF(cleanCpf)) {
            return res.status(400).json({ error: 'CPF inválido.' });
        }

        // Regra de acesso: CPF precisa estar liberado (Member.status = ACTIVE)
        const member = await prisma.member.findUnique({ where: { cpf: cleanCpf } });
        if (!member || member.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'CPF bloqueado. Procure o responsável para liberação.' });
        }

        // Upsert logic to guarantee uniqueness by CPF
        const cadastro = await prisma.cadastro.upsert({
            where: { cpf: cleanCpf },
            update: {
                ...data,
                cpf: cleanCpf,
                data_envio: new Date(),
                status: 'CONCLUÍDO'
            },
            create: {
                ...data,
                cpf: cleanCpf,
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

// Buscar cadastro por CPF (sem autenticação - apenas consulta pessoal)
router.get('/consulta/:cpf', async (req: Request, res: Response) => {
    try {
        const { cpf } = req.params;
        const cleanCpf = normalizeCpf(cpf);

        if (!cleanCpf || cleanCpf.length !== 11) {
            return res.status(400).json({ error: 'CPF inválido.' });
        }

        // Regra de acesso: CPF precisa estar liberado (Member.status = ACTIVE)
        const member = await prisma.member.findUnique({ where: { cpf: cleanCpf } });
        if (!member || member.status !== 'ACTIVE') {
            return res.status(403).json({ error: 'CPF bloqueado. Procure o responsável para liberação.' });
        }

        const cadastro = await prisma.cadastro.findUnique({
            where: { cpf: cleanCpf }
        });

        if (!cadastro) {
            return res.status(404).json({ error: 'Cadastro não encontrado.' });
        }

        res.json(cadastro);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar cadastro.' });
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
