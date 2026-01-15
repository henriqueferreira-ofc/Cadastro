
import React, { useState, useEffect } from 'react';
import logo from './logo.png';
import { BaseAutorizada, ViewState } from './types';
import { DBService } from './db_service';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import AdminDashboard from './components/AdminDashboard';
import SuccessScreen from './components/SuccessScreen';
import AdminAuthModal from './components/AdminAuthModal';
import { ShieldCheck, UserCog } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('AUTH');
  const [activeUser, setActiveUser] = useState<BaseAutorizada | null>(null);
  const [showAdminAuth, setShowAdminAuth] = useState(false);

  useEffect(() => {
    DBService.init();
    DBService.loadAuthorizedCPFs();
  }, []);

  const handleLoginSuccess = (user: BaseAutorizada) => {
    setActiveUser(user);
    setView('FORM');
  };

  const handleRegistrationSuccess = () => {
    setView('SUCCESS');
  };

  const resetFlow = () => {
    setActiveUser(null);
    setView('AUTH');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-blue-900 text-white p-2 sm:p-3 shadow-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 sm:gap-2.5 cursor-pointer" onClick={resetFlow}>
            <div className="bg-white rounded-full p-0.5 shadow-sm flex-shrink-0">
              <img src={logo} alt="Logo AAFAB" className="h-8 sm:h-9 w-auto" />
            </div>
            <h1 className="text-[9px] sm:text-[10px] md:text-xs font-bold tracking-tight leading-tight">Portal de Atualização Cadastral - AAFAB</h1>
          </div>
          <button
            onClick={() => setShowAdminAuth(true)}
            className="text-blue-200 hover:text-white transition-colors flex items-center gap-1 text-[10px] sm:text-xs font-medium flex-shrink-0 whitespace-nowrap"
          >
            <UserCog className="w-4 h-4" />
            <span className="hidden sm:inline">Painel Admin</span>
            <span className="sm:hidden">Admin</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-10 sm:py-12 px-3 sm:px-4">
        <div className="max-w-3xl mx-auto">
          {view === 'AUTH' && <LoginForm onSuccess={handleLoginSuccess} />}
          {view === 'FORM' && activeUser && (
            <RegistrationForm
              user={activeUser}
              onSuccess={handleRegistrationSuccess}
              onCancel={resetFlow}
            />
          )}
          {view === 'SUCCESS' && <SuccessScreen onRestart={resetFlow} />}
          {view === 'ADMIN' && <AdminDashboard onBack={resetFlow} />}
        </div>
      </main>

      {/* Admin Auth Modal */}
      {showAdminAuth && (
        <AdminAuthModal
          onSuccess={() => {
            setView('ADMIN');
            setShowAdminAuth(false);
          }}
          onClose={() => setShowAdminAuth(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-[10px] sm:text-xs text-gray-400">
        <div className="max-w-4xl mx-auto px-4">
          <p>&copy; 2026 Portal Corporativo de Atualização Cadastral. AAFAB - Associação Amigos da Força Áerea Brasileira. Em conformidade com a LGPD.</p>
          <p className="mt-1">Acesso restrito e monitorado.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
