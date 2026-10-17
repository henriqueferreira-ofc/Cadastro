const ADMIN_SESSION_KEY = 'aafab_admin_session';

export const adminSession = {
  get: () => sessionStorage.getItem(ADMIN_SESSION_KEY),
  set: (token: string) => sessionStorage.setItem(ADMIN_SESSION_KEY, token),
  clear: () => sessionStorage.removeItem(ADMIN_SESSION_KEY),
};
