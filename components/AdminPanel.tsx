import React, { useState, useEffect } from 'react';
import { ChevronLeft, ClipboardList, FolderOpen, Megaphone, Wallet } from 'lucide-react';
import AdminDashboard from './AdminDashboard';
import SecretaryPage from './management/SecretaryPage';
import FinancePage from './management/FinancePage';
import CommunicationsPage from './management/CommunicationsPage';
import { managementApi } from '../management_service';
import { adminLogout } from '../admin_session';

const pages = [
  { id: 'cadastro', label: 'Cadastro', icon: ClipboardList },
  { id: 'comunicacao', label: 'Comunicação', icon: Megaphone },
  { id: 'secretaria', label: 'Secretaria', icon: FolderOpen },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet },
] as const;

type AdminPage = (typeof pages)[number]['id'];

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [activePage, setActivePage] = useState<AdminPage>('cadastro');

  const [visited, setVisited] = useState<AdminPage[]>(['cadastro']);
  const [development, setDevelopment] = useState(false);
  const handleBack = () => {
    void adminLogout();
    onBack();
  };
  useEffect(() => {
    managementApi<{ development: boolean }>('/ambiente')
      .then((data) => setDevelopment(data.development))
      .catch(() => {});
  }, [activePage]);

  return (
    <div className="admin-panel">
      <nav
        aria-label="Páginas administrativas"
        className="mb-4 flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm sm:mb-6 sm:justify-between sm:gap-3 sm:p-2"
      >
        <div className="grid min-w-0 flex-1 grid-cols-4 gap-1 sm:flex-none sm:gap-2">
          {pages.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActivePage(id);
                setVisited((current) => (current.includes(id) ? current : [...current, id]));
              }}
              aria-current={activePage === id ? 'page' : undefined}
              aria-controls={`admin-page-${id}`}
              className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:flex-row sm:gap-2 sm:px-5 sm:py-3 sm:text-sm ${
                activePage === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleBack}
          aria-label="Voltar ao início"
          className="flex min-h-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex-row sm:px-3 sm:text-sm"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          <span className="sm:hidden">Início</span>
          <span className="hidden sm:inline">Voltar ao início</span>
        </button>
      </nav>

      {development && (
        <div
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 sm:px-4 sm:py-3 sm:text-sm"
          role="status"
        >
          <strong>Ambiente de desenvolvimento.</strong> Você está usando uma cópia dos cadastros. As
          alterações aqui não afetam o site oficial.
        </div>
      )}
      <section id="admin-page-cadastro" aria-label="Cadastro" hidden={activePage !== 'cadastro'}>
        <AdminDashboard />
      </section>

      <section
        id="admin-page-comunicacao"
        aria-label="Comunicação"
        hidden={activePage !== 'comunicacao'}
      >
        {visited.includes('comunicacao') && <CommunicationsPage />}
      </section>

      <section
        id="admin-page-secretaria"
        aria-label="Secretaria"
        hidden={activePage !== 'secretaria'}
      >
        {visited.includes('secretaria') && <SecretaryPage />}
      </section>
      <section
        id="admin-page-financeiro"
        aria-label="Financeiro"
        hidden={activePage !== 'financeiro'}
      >
        {visited.includes('financeiro') && <FinancePage />}
      </section>
    </div>
  );
};

export default AdminPanel;
