import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import type { UserRole } from "../../types";

export default function RoleRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { profile } = useAuth();
  const currentRole = (profile?.role ?? "ADMIN") as UserRole;

  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
