import { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../api';
import { registerPushToken, unregisterPushToken } from '../notifications';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = api.onUnauthorized(() => {
      setUser(null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('condo_token');
        if (token) {
          const data = await api.getMe();
          setUser(data.user);
          registerPushToken(); // fire-and-forget
        }
      } catch {
        await AsyncStorage.removeItem('condo_token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    registerPushToken(); // fire-and-forget
    return data;
  };

  const logout = async () => {
    unregisterPushToken().catch(() => {}); // best-effort
    await api.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
    } catch {}
  };

  const isSuperAdmin  = user?.role === 'Super Admin';
  const isAdmin       = user?.role === 'Administrador';
  const isSeguridad   = user?.role === 'Seguridad';
  const isOwner       = user?.role === 'Propietario';
  const isTenant      = user?.role === 'Inquilino';
  const isResident    = isOwner || isTenant;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isSuperAdmin, isAdmin, isSeguridad, isOwner, isTenant, isResident }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
