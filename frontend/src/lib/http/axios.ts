import axios from "axios";
import { token } from "../token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

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
      original?.url && /\/auth\/login\//.test(String(original.url));

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
            .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refreshToken })
            .then((r) => r.data);
        }

        const refreshed = await refreshPromise;
        token.setAccess(refreshed.accessToken);
        token.setRefresh(refreshed.refreshToken);

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
