import React, { useState, useEffect } from 'react';
import { ChevronLeft, ClipboardList, FolderOpen, Megaphone, RefreshCw, Wallet } from 'lucide-react';
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
  const [connected, setConnected] = useState<boolean | null>(null);
  // Cada página é recriada quando o contador dela muda, o que recarrega os dados sem sair do painel.
  const [refreshKeys, setRefreshKeys] = useState<Record<AdminPage, number>>({
    cadastro: 0,
    comunicacao: 0,
    secretaria: 0,
    financeiro: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const refreshActive = () => {
    setRefreshing(true);
    setRefreshKeys((current) => ({ ...current, [activePage]: current[activePage] + 1 }));
    managementApi<{ development: boolean; connected: boolean }>('/ambiente')
      .then((data) => {
        setDevelopment(data.development);
        setConnected(data.connected);
      })
      .catch(() => setConnected(false))
      .finally(() => {
        setUpdatedAt(new Date());
        window.setTimeout(() => setRefreshing(false), 600);
      });
  };
  const handleBack = () => {
    void adminLogout();
    onBack();
  };
  useEffect(() => {
    managementApi<{ development: boolean; connected: boolean }>('/ambiente')
      .then((data) => {
        setDevelopment(data.development);
        setConnected(data.connected);
      })
      .catch(() => setConnected(false));
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
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={refreshActive}
            disabled={refreshing}
            aria-label="Atualizar esta página"
            title={`Atualizar esta página · última atualização às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            className="flex min-h-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-70 sm:flex-row sm:px-3 sm:text-sm"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
          <button
            type="button"
            onClick={handleBack}
            aria-label="Voltar ao início"
            className="flex min-h-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex-row sm:px-3 sm:text-sm"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao início</span>
          </button>
        </div>
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
        <AdminDashboard
          key={`cadastro-${refreshKeys.cadastro}`}
          environment={{ development, connected }}
        />
      </section>

      <section
        id="admin-page-comunicacao"
        aria-label="Comunicação"
        hidden={activePage !== 'comunicacao'}
      >
        {visited.includes('comunicacao') && (
          <CommunicationsPage key={`comunicacao-${refreshKeys.comunicacao}`} />
        )}
      </section>

      <section
        id="admin-page-secretaria"
        aria-label="Secretaria"
        hidden={activePage !== 'secretaria'}
      >
        {visited.includes('secretaria') && (
          <SecretaryPage key={`secretaria-${refreshKeys.secretaria}`} />
        )}
      </section>
      <section
        id="admin-page-financeiro"
        aria-label="Financeiro"
        hidden={activePage !== 'financeiro'}
      >
        {visited.includes('financeiro') && (
          <FinancePage key={`financeiro-${refreshKeys.financeiro}`} />
        )}
      </section>
    </div>
  );
};

export default AdminPanel;
