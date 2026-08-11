import { Navigate, Outlet } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "./AuthProvider";

export const ProtectedRoute = (): ReactElement => {
  const { user, loading, configured } = useAuth();

  if (!configured) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <main className="p-8">Checking your session...</main>;
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};
