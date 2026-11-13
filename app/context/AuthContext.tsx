/**
 * Authentication state. An account is mandatory: the app shows the auth screen while signed out.
 * Tokens live in secure storage (see api/index.ts); only the profile is cached for offline display.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { ApiUser } from '../api/client';

const USER_CACHE_KEY = 'NOMA_USER_V1';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextType {
  status: AuthStatus;
  user: ApiUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the account from the server (after a profile change). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(me)).catch(() => undefined);
    } catch {
      // Offline: keep the cached profile. A dead session is handled by the expiry callback.
    }
  }, []);

  useEffect(() => {
    api.setOnSessionExpired(() => {
      setUser(null);
      setStatus('signedOut');
    });
    let cancelled = false;
    (async () => {
      if (!(await api.hasSession())) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      const cached = await AsyncStorage.getItem(USER_CACHE_KEY).catch(() => null);
      if (!cancelled) {
        if (cached) setUser(JSON.parse(cached) as ApiUser);
        setStatus('signedIn'); // optimistic: recording must work offline
      }
      loadProfile();
    })();
    return () => {
      cancelled = true;
      api.setOnSessionExpired(null);
    };
  }, [loadProfile]);

  const afterSignIn = useCallback(async () => {
    setStatus('signedIn');
    await loadProfile();
  }, [loadProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      status,
      user,
      login: async (email, password) => {
        await api.login(email.trim().toLowerCase(), password);
        await afterSignIn();
      },
      register: async (email, password, displayName) => {
        await api.register(email.trim().toLowerCase(), password, displayName?.trim() || undefined);
        await afterSignIn();
      },
      refreshUser: loadProfile,
      logout: async () => {
        await api.logout();
        await AsyncStorage.removeItem(USER_CACHE_KEY).catch(() => undefined);
        setUser(null);
        setStatus('signedOut');
      },
    }),
    [status, user, afterSignIn, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
