/**
 * RoleRoute — guards routes based on user role.
 * Normalizes backend role values ('project_manager', 'admin', 'developer')
 * and frontend role constants ('MANAGER', 'ADMIN', 'DEVELOPER').
 */
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { normalizeRole } from "../../services/profileService";
import LoadingScreen from "../ui/LoadingScreen";
import type { UserRole } from "../../types";

export default function RoleRoute({
  allowedRoles,
}: {
  allowedRoles: (UserRole | string)[];
}) {
  const { profile, user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Obtain role from profile, falling back to authenticated user session
  const rawRole = profile?.role || user?.role;
  if (!rawRole) {
    // If authenticated but role has not resolved yet, show loading instead of premature redirect
    return <LoadingScreen />;
  }

  const currentNormalized = normalizeRole(rawRole);

  // Check if current role matches any allowed role (normalized or raw)
  const isAllowed = allowedRoles.some((allowed) => {
    const normalizedAllowed = normalizeRole(allowed);
    return (
      normalizedAllowed === currentNormalized ||
      allowed.toUpperCase() === rawRole.toUpperCase() ||
      allowed.toLowerCase() === rawRole.toLowerCase()
    );
  });

  if (!isAllowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
