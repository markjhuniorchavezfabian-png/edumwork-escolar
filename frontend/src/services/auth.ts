import api from "./api";
import type { LoginCredentials, Usuario } from "../types";

export async function login(credentials: LoginCredentials): Promise<{ usuario: Usuario }> {
  const { data } = await api.post("/auth/login/", credentials);
  localStorage.setItem("iev_access", data.access);
  localStorage.setItem("iev_refresh", data.refresh);
  return data;
}

export function logout() {
  localStorage.removeItem("iev_access");
  localStorage.removeItem("iev_refresh");
}

export async function getCurrentUser(): Promise<Usuario> {
  const { data } = await api.get("/auth/me/");
  return data;
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem("iev_access");
}
