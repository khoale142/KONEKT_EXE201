import axios from "axios";
import { token } from "../token";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

let refreshPromise: Promise<{ accessToken: string; refreshToken: string; user?: import("../../app/store/auth.store").AuthUser }> | null = null;

api.interceptors.request.use((config) => {
  const access = token.getAccess();
  if (access) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err?.config;
    const isLoginRequest =
      original?.url && /\/auth\/(login|register|demo-login|refresh|activate-workspace)/.test(String(original.url));

    // Never run refresh when the failed request was a login (user is signing in).
    if (isLoginRequest) throw err;

    if (err.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      const refreshToken = token.getRefresh();
      if (!refreshToken) {
        token.clear();
        throw err;
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
            .then((r) => r.data);
        }

        const refreshed = await refreshPromise;
        token.setAccess(refreshed.accessToken);
        token.setRefresh(refreshed.refreshToken);

        if (refreshed.user) {
          const { useAuthStore } = await import("../../app/store/auth.store");
          useAuthStore.getState().setTokensAndUser(refreshed.accessToken, refreshed.refreshToken, refreshed.user);
        }
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${refreshed.accessToken}`;
        return api(original);
      } catch (refreshError) {
        token.clear();
        throw refreshError;
      } finally {
        refreshPromise = null;
      }
    }

    throw err;
  },
);

export default api;
