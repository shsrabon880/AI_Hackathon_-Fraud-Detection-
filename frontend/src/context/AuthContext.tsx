import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

export interface AuthUser {
  id: number;
  user_code: string;
  full_name: string;
  email: string;
  phone_number?: string | null;
  country?: string;
  preferred_language?: string;
  role: "user" | "analyst" | "admin";
  status: string;
  email_verified?: boolean;
  mfa_enabled: boolean;
  connected_accounts_count: number;
  created_at: string;
  last_login_at: string | null;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phoneNumber: string;
  country: string;
  preferredLanguage: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  message: string;
  verification_required: boolean;
  email: string;
  expires_in_seconds: number;
  resend_cooldown_seconds: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    mfaCode?: string,
    rememberMe?: boolean
  ) => Promise<{ mfa_required?: boolean }>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  verifySignupOtp: (email: string, otp: string) => Promise<{ verified: boolean; message: string }>;
  resendSignupOtp: (
    email: string
  ) => Promise<{ message: string; expires_in_seconds: number; resend_cooldown_seconds: number }>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<{ message: string }>;
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

  const login = async (email: string, password: string, mfaCode?: string, rememberMe = false) => {
    const res = await api.request<{
      mfa_required: boolean;
      access_token?: string;
      user?: AuthUser;
    }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        remember_me: rememberMe,
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

  const register = async (p: RegisterPayload) => {
    return api.request<RegisterResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({
        full_name: p.fullName,
        email: p.email,
        phone_number: p.phoneNumber || null,
        country: p.country || "Bangladesh",
        preferred_language: p.preferredLanguage || "en",
        password: p.password,
        confirm_password: p.confirmPassword,
      }),
    });
  };

  const verifySignupOtp = async (email: string, otp: string) => {
    return api.request<{ verified: boolean; message: string }>("/api/v1/auth/verify-signup-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  };

  const resendSignupOtp = async (email: string) => {
    return api.request<{
      message: string;
      expires_in_seconds: number;
      resend_cooldown_seconds: number;
    }>("/api/v1/auth/resend-signup-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  const forgotPassword = async (email: string) => {
    return api.request<{ message: string }>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  };

  const resetPassword = async (
    email: string,
    otp: string,
    newPassword: string,
    confirmPassword: string
  ) => {
    return api.request<{ message: string }>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email,
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifySignupOtp,
        resendSignupOtp,
        forgotPassword,
        resetPassword,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
