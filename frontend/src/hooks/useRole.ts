import type { Rol } from "../types";
import { useAuth } from "./useAuth";

export function useRole(...roles: Rol[]): boolean {
  const { tienePermiso } = useAuth();
  return tienePermiso(roles);
}
