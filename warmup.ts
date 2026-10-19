import { getBackendUrl } from './utils';

// O Render (plano free) hiberna a API. Um ping ao abrir o site a acorda antes do primeiro login.
export function warmUpBackend(): void {
  try {
    const healthUrl = `${getBackendUrl().replace(/\/api$/, '')}/health`;
    void fetch(healthUrl, { cache: 'no-store', mode: 'no-cors' }).catch(() => undefined);
  } catch {
    // aquecimento é só otimização
  }
}
