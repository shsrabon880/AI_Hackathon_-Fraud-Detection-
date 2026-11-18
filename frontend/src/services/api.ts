const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

class ApiClient {
  private token: string | null = sessionStorage.getItem("fs_access_token");
  private refreshing: Promise<boolean> | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      sessionStorage.setItem("fs_access_token", token);
    } else {
      sessionStorage.removeItem("fs_access_token");
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          if (!res.ok) return false;
          const data = await res.json();
          if (data?.access_token) {
            this.setToken(data.access_token);
            return true;
          }
          return false;
        } catch {
          return false;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  async request<T>(path: string, options: RequestInit = {}, allowRetry = true): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const csrf = getCookie("fs_csrf_token");
    if (csrf) {
      headers["X-CSRF-Token"] = csrf;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (
      res.status === 401 &&
      allowRetry &&
      !path.includes("/auth/login") &&
      !path.includes("/auth/refresh")
    ) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request<T>(path, options, false);
      }
    }

    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const err = await res.json();
        if (err?.detail) {
          msg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
        }
      } catch {
        // ignore JSON parse failure
      }
      throw new Error(msg);
    }

    if (res.status === 204) {
      return {} as T;
    }
    return res.json() as Promise<T>;
  }

  async downloadFile(path: string, filename: string) {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to download statement export.");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();
