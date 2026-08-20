import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../api';
import { useAuth } from './AuthContext';

const CondoCtx = createContext({ condoName: '', reloadCondo: () => {} });

export function CondoProvider({ children }) {
  const { user, isSuperAdmin } = useAuth();
  const [condoName, setCondoName] = useState('');

  const reloadCondo = useCallback(async () => {
    if (!user) return;
    try {
      if (isSuperAdmin) {
        const res = await api.getCondominios();
        const list = Array.isArray(res) ? res : (res.condominios ?? []);
        setCondoName(list[0]?.name ?? '');
      } else {
        setCondoName(user.condo ?? '');
      }
    } catch { /* ignore */ }
  }, [user, isSuperAdmin]);

  useEffect(() => { reloadCondo(); }, [reloadCondo]);

  return (
    <CondoCtx.Provider value={{ condoName, reloadCondo }}>
      {children}
    </CondoCtx.Provider>
  );
}

export function useCondo() {
  return useContext(CondoCtx);
}
