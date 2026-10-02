'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '@/lib/api';
import { clearToken, getToken, setToken } from '@/lib/auth';

export type AuthUser = {
  user_id: number;
  name: string;
  email: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'suspended';
  monthly_income: number;
  city: string | null;
  occupation: string | null;
  phone?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  preferred_theme?: string;
  preferred_compact_mode?: boolean;
  preferred_currency?: string;
  preferred_date_format?: string;
  preferred_language?: string;
  created_at: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  monthly_income?: number;
  city?: string;
  occupation?: string;
};

export type OnboardingStatus = {
  onboarding_required: boolean;
  onboarding_completed: boolean;
  has_draft_plan: boolean;
  has_active_plan: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  onboarding: OnboardingStatus | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
  updateToken: (token: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOnboarding = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setOnboarding(null);
      return;
    }

    try {
      const data = await apiRequest<OnboardingStatus>('/onboarding/status', {
        method: 'GET',
        auth: true,
      });
      setOnboarding(data);
    } catch {
      setOnboarding(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setUser(null);
      setOnboarding(null);
      setLoading(false);
      return;
    }

    try {
      const data = await apiRequest<{ user: AuthUser; onboarding?: OnboardingStatus }>('/auth/me', {
        method: 'GET',
        auth: true,
      });

      setUser(data.user);

      if (data.onboarding) {
        setOnboarding(data.onboarding);
      } else {
        await refreshOnboarding();
      }
    } catch {
      clearToken();
      setUser(null);
      setOnboarding(null);
    } finally {
      setLoading(false);
    }
  }, [refreshOnboarding]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const data = await apiRequest<{ token: string; user: AuthUser; onboarding?: OnboardingStatus }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    setToken(data.token);
    setUser(data.user);
    if (data.onboarding) {
      setOnboarding(data.onboarding);
    } else {
      await refreshOnboarding();
    }

    return data.user;
  }, [refreshOnboarding]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await apiRequest<{ token: string; user: AuthUser; onboarding?: OnboardingStatus }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setToken(data.token);
    setUser(data.user);
    if (data.onboarding) {
      setOnboarding(data.onboarding);
    } else {
      await refreshOnboarding();
    }
  }, [refreshOnboarding]);

  const logout = () => {
    clearToken();
    setUser(null);
    setOnboarding(null);
  };

  const updateToken = useCallback(async (token: string) => {
    setToken(token);
    await refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      onboarding,
      login,
      register,
      logout,
      refreshUser,
      refreshOnboarding,
      updateToken,
    }),
    [user, loading, onboarding, login, register, refreshUser, refreshOnboarding, updateToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
