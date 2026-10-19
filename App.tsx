import React, { useState, useEffect, useCallback } from 'react';
import logo from './logo.png';
import { BaseAutorizada, ViewState } from './types';
import { DBService } from './db_service';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import AdminPanel from './components/AdminPanel';
import SuccessScreen from './components/SuccessScreen';
import AdminAuthModal from './components/AdminAuthModal';
import MemberPortal from './components/member/MemberPortal';
import { memberSession } from './member_session';
import { ShieldCheck, UserCog, UserRound } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('AUTH');
  const [activeUser, setActiveUser] = useState<BaseAutorizada | null>(null);
  const [showAdminAuth, setShowAdminAuth] = useState(false);

  useEffect(() => {
    DBService.prewarmBackend();
    if (memberSession.get()) setView('MEMBER');
  }, []);

  const handleLoginSuccess = (user: BaseAutorizada) => {
    setActiveUser(user);
    setView('FORM');
  };

  const handleRegistrationSuccess = () => {
    setView('SUCCESS');
  };

  const resetFlow = useCallback(() => {
    setActiveUser(null);
    setView('AUTH');
  }, []);

  const leaveMemberPortal = useCallback(() => {
    memberSession.clear();
    resetFlow();
  }, [resetFlow]);

  const wideView = view === 'ADMIN' || view === 'MEMBER';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 bg-blue-900 text-white shadow-md ${wideView ? 'px-3 py-3 sm:px-4' : 'p-2 sm:p-3'}`}
      >
        <div
          className={`mx-auto flex items-center justify-between gap-4 ${wideView ? 'max-w-6xl' : 'max-w-3xl'}`}
        >
          <div
            className={`flex items-center gap-2 sm:gap-2.5 ${view === 'MEMBER' ? '' : 'cursor-pointer'}`}
            onClick={view === 'MEMBER' ? undefined : resetFlow}
          >
            <div className="bg-white rounded-full p-0.5 shadow-sm flex-shrink-0">
              <img
                src={logo}
                alt="Logo AAFAB"
                className={`w-auto ${wideView ? 'h-9 sm:h-10' : 'h-8 sm:h-9'}`}
              />
            </div>
            <h1
              className={`font-bold tracking-tight leading-tight ${wideView ? 'text-xs sm:text-base' : 'text-[9px] sm:text-[10px] md:text-xs'}`}
            >
              {view === 'ADMIN' ? (
                <>
                  <span className="block text-sm sm:hidden">AAFAB</span>
                  <span className="text-xs font-medium text-blue-100 sm:hidden">
                    Portal Administrativo
                  </span>
                  <span className="hidden sm:inline">Portal Administrativo — AAFAB</span>
                </>
              ) : view === 'MEMBER' ? (
                <>
                  <span className="block text-sm sm:hidden">AAFAB</span>
                  <span className="text-xs font-medium text-blue-100 sm:hidden">
                    Portal do Associado
                  </span>
                  <span className="hidden sm:inline">AAFAB — Portal do Associado</span>
                </>
              ) : (
                'Portal de Atualização Cadastral - AAFAB'
              )}
            </h1>
          </div>
          {view === 'ADMIN' ? (
            <span className="flex shrink-0 items-center gap-2 rounded-full border border-blue-700 bg-blue-800 px-2.5 py-1.5 text-xs font-medium text-blue-100 sm:px-3">
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Área administrativa</span>
              <span className="sm:hidden">Admin</span>
            </span>
          ) : view === 'MEMBER' ? (
            <span className="flex shrink-0 items-center gap-2 rounded-full border border-blue-700 bg-blue-800 px-2.5 py-1.5 text-xs font-medium text-blue-100 sm:px-3">
              <UserRound aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Área do associado</span>
              <span className="sm:hidden">Associado</span>
            </span>
          ) : (
            <button
              onClick={() => setShowAdminAuth(true)}
              className="text-blue-200 hover:text-white transition-colors flex items-center gap-1 text-[10px] sm:text-xs font-medium flex-shrink-0 whitespace-nowrap"
            >
              <UserCog className="w-4 h-4" />
              <span className="hidden sm:inline">Painel Admin</span>
              <span className="sm:hidden">Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-grow px-3 sm:px-4 ${wideView ? 'py-3 sm:py-6' : 'py-8 sm:py-12'}`}
      >
        <div className={`mx-auto ${wideView ? 'max-w-6xl' : 'max-w-3xl'}`}>
          {view === 'AUTH' && (
            <LoginForm
              onRegistrationSuccess={handleLoginSuccess}
              onMemberSuccess={() => setView('MEMBER')}
            />
          )}
          {view === 'FORM' && activeUser && (
            <RegistrationForm
              user={activeUser}
              onSuccess={handleRegistrationSuccess}
              onCancel={resetFlow}
            />
          )}
          {view === 'SUCCESS' && <SuccessScreen onRestart={resetFlow} />}
          {view === 'MEMBER' && <MemberPortal onLogout={leaveMemberPortal} />}
          {view === 'ADMIN' && <AdminPanel onBack={resetFlow} />}
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
          <p>
            &copy; 2026 Portal Corporativo de Atualização Cadastral. AAFAB - Associação Amigos da
            Força Áerea Brasileira. Em conformidade com a LGPD.
          </p>
          <p className="mt-1">Acesso restrito e monitorado.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
