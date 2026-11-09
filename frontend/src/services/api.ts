import axios from "axios";
import { API_BASE_URL as BASE_URL } from "../constants/env";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("iev_access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const isAuthRoute =
      original?.url?.includes("/auth/login/") ||
      original?.url?.includes("/auth/refresh/");

    if (err.response?.status === 401 && !original?._retry && !isAuthRoute) {
      original._retry = true;
      const refresh = localStorage.getItem("iev_refresh");
      if (!refresh) {
        _cerrarSesion();
        return Promise.reject(err);
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh/`, { refresh });
        localStorage.setItem("iev_access", data.access);
        if (data.refresh) localStorage.setItem("iev_refresh", data.refresh);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        _cerrarSesion();
        return Promise.reject(err);
      }
    }
    return Promise.reject(err);
  }
);

function _cerrarSesion() {
  localStorage.removeItem("iev_access");
  localStorage.removeItem("iev_refresh");
  window.location.href = "/login";
}

export default api;
