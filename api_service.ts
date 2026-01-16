const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const ADMIN_TOKEN = 'aaafab_admin_secret_2024';

export const ApiService = {
    saveCadastro: async (data: any) => {
        const response = await fetch(`${API_URL}/cadastro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    getAdminCadastros: async () => {
        const response = await fetch(`${API_URL}/cadastro/admin/list`, {
            headers: { 'Authorization': ADMIN_TOKEN },
        });
        if (!response.ok) throw new Error('Falha ao buscar dados do servidor.');
        return response.json();
    },

    exportToExcel: async () => {
        const response = await fetch(`${API_URL}/cadastro/admin/export`, {
            headers: { 'Authorization': ADMIN_TOKEN },
        });
        if (!response.ok) throw new Error('Falha ao exportar arquivo.');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cadastros_aafab.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    }
};
