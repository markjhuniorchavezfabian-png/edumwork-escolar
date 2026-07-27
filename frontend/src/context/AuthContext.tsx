import React, { createContext, useContext, useEffect, useState } from "react";
import type { LoginCredentials, Rol, Usuario } from "../types";
import { login as authLogin, logout as authLogout, getCurrentUser, isLoggedIn } from "../services/auth";

interface AuthContextValue {
  usuario: Usuario | null;
  isAuthenticated: boolean;
  cargando: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  tienePermiso: (roles: Rol[]) => boolean;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      getCurrentUser()
        .then(setUsuario)
        .catch(() => {
          authLogout();
        })
        .finally(() => setCargando(false));
    } else {
      setCargando(false);
    }
  }, []);

  async function login(credentials: LoginCredentials) {
    const data = await authLogin(credentials);
    setUsuario(data.usuario);
  }

  function logout() {
    authLogout();
    setUsuario(null);
  }

  function tienePermiso(roles: Rol[]) {
    if (!usuario) return false;
    return roles.includes(usuario.rol);
  }

  async function refreshUsuario() {
    const u = await getCurrentUser();
    setUsuario(u);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isAuthenticated: !!usuario,
        cargando,
        login,
        logout,
        tienePermiso,
        refreshUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext debe usarse dentro de AuthProvider");
  return ctx;
}
