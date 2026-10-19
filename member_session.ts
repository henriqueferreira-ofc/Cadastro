const storageKey = 'aafab_member_session';

export const memberSession = {
  get(): string | null {
    return sessionStorage.getItem(storageKey);
  },
  set(token: string): void {
    sessionStorage.setItem(storageKey, token);
  },
  clear(): void {
    sessionStorage.removeItem(storageKey);
  },
};
