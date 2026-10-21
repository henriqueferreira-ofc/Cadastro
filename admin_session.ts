import { getBackendUrl } from './utils';

const ADMIN_SESSION_KEY = 'aafab_admin_session';

export const adminSession = {
  get: () => sessionStorage.getItem(ADMIN_SESSION_KEY),
  set: (token: string) => sessionStorage.setItem(ADMIN_SESSION_KEY, token),
  clear: () => sessionStorage.removeItem(ADMIN_SESSION_KEY),
};

// Encerra a sessão também no servidor, para o token deixar de valer na hora.
export async function adminLogout(): Promise<void> {
  const token = adminSession.get();
  adminSession.clear();
  if (!token) return;
  try {
    await fetch(`${getBackendUrl()}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // O token expira sozinho em até 30 minutos.
  }
}
