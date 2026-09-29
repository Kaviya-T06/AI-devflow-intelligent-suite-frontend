/**
 * ProtectedRoute — redirects unauthenticated users to /login.
 * Shows a loading spinner while session is being resolved.
 */
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingScreen from "../ui/LoadingScreen";

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    // Remember the page they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
