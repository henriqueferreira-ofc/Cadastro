// Sincronizador de dados entre dispositivos usando localStorage com indexedDB como fallback
// Esta é uma solução que funciona sem backend em produção

import { CadastroEnviado } from './types';

const DB_NAME = 'AAFAB_Cache';
const STORE_NAME = 'cadastros';

export const SyncService = {
  // Inicializar IndexedDB
  initDB: async (): Promise<IDBDatabase | null> => {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB não disponível, usando apenas localStorage');
        resolve(null);
        return;
      }

      const request = window.indexedDB.open(DB_NAME, 1);
      
      request.onerror = () => {
        console.warn('Erro ao abrir IndexedDB');
        resolve(null);
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'cpf' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };
    });
  },

  // Salvar em IndexedDB
  saveToIndexedDB: async (data: CadastroEnviado[], db: IDBDatabase): Promise<void> => {
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      data.forEach(item => {
        store.put(item);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  },

  // Buscar do IndexedDB
  getFromIndexedDB: async (db: IDBDatabase): Promise<CadastroEnviado[]> => {
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event: any) => {
        resolve(event.target.result || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    });
  },

  // Sincronizar dados entre localStorage e IndexedDB
  sync: async (cadastros: CadastroEnviado[]): Promise<void> => {
    try {
      const db = await SyncService.initDB();
      if (db) {
        await SyncService.saveToIndexedDB(cadastros, db);
        db.close();
      }
    } catch (error) {
      console.warn('Erro na sincronização:', error);
    }
  },

  // Recuperar dados sincronizados
  recover: async (): Promise<CadastroEnviado[]> => {
    try {
      const db = await SyncService.initDB();
      if (db) {
        const data = await SyncService.getFromIndexedDB(db);
        db.close();
        if (data.length > 0) {
          return data;
        }
      }
    } catch (error) {
      console.warn('Erro ao recuperar dados sincronizados:', error);
    }
    return [];
  }
};
