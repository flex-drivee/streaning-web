import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import Spinner from "../components/Spinner";
import { AppPaths } from "./paths";

// ✅ Stricter type for the role prop
interface ProtectedRouteProps {
  children?: React.ReactNode;
  requiredRole?: "user" | "admin";
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  // ✅ Get the full user object for more robust checks
  const { user, isAuthenticated, loading } = useAuth();

  // Show loading spinner while auth state is being determined
  if (loading) {
    return <Spinner />;
  }

  // ✅ Explicit check for both auth status and user object
  if (!isAuthenticated || !user) {
    return <Navigate to={AppPaths.LOGIN} replace />;
  }

  // ✅ Check the role directly from the user object
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={AppPaths.HOME} replace />;
  }

  // ✅ If all checks pass, render the content
  return <>{children || <Outlet />}</>;
};

export default ProtectedRoute;
