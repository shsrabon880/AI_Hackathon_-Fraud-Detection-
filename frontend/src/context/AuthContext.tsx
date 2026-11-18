import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

export interface AuthUser {
  id: number;
  user_code: string;
  full_name: string;
  email: string;
  role: "user" | "analyst" | "admin";
  status: string;
  mfa_enabled: boolean;
  connected_accounts_count: number;
  created_at: string;
  last_login_at: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ mfa_required?: boolean }>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const me = await api.request<AuthUser>("/api/v1/auth/me");
      setUser(me);
    } catch {
      setUser(null);
      api.setToken(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, mfaCode?: string) => {
    const res = await api.request<{
      mfa_required: boolean;
      access_token?: string;
      user?: AuthUser;
    }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        mfa_code: mfaCode || null,
        device_name: navigator.platform || "Web Browser",
      }),
    });

    if (res.mfa_required) {
      return { mfa_required: true };
    }
    if (res.access_token) {
      api.setToken(res.access_token);
    }
    if (res.user) {
      setUser(res.user);
    } else {
      await refreshUser();
    }
    return { mfa_required: false };
  };

  const register = async (fullName: string, email: string, password: string) => {
    await api.request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name: fullName, email, password }),
    });
  };

  const logout = async () => {
    try {
      await api.request("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Clear local session regardless
    } finally {
      api.setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
