// src/routes/AppRoutes.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AdminPage from "../pages/AdminPage";
import LoginPage from "../pages/LoginPage";
import SignUpPage from "../pages/SignUpPage";
import HomePage from "../pages/HomePage";
import SeriesPage from "../pages/SeriesPage";
import MoviesPage from "../pages/MoviesPage";
import MyListPage from "../pages/MyListPage";
import SearchPage from "../pages/SearchPage";
import { AppPaths } from "./paths";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "../layout/Layout";
import { useAuth } from "../Contexts/AuthContext";


const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Default redirect (This part is already correct) */}
      <Route
        path={AppPaths.ROOT} // ✅ Use constant
        element={
          isAuthenticated? (
            <Navigate to={AppPaths.HOME} replace />
          ) : (
            <Navigate to={AppPaths.LOGIN} replace />
          )
        }
      />

      {/* Auth pages */}
      <Route path={AppPaths.LOGIN} element={<LoginPage />} /> {/* ✅ Use constant */}
      <Route path={AppPaths.SIGNUP} element={<SignUpPage />} /> {/* ✅ Use constant */}

      {/* Protected routes with Layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path={AppPaths.HOME} element={<HomePage />} /> {/* ✅ Use constant */}
        <Route path={AppPaths.SERIES} element={<SeriesPage />} /> {/* ✅ Use constant */}
        <Route path={AppPaths.MOVIES} element={<MoviesPage />} /> {/* ✅ Use constant */}
        <Route path={AppPaths.MY_LIST} element={<MyListPage />} /> {/* ✅ Use constant */}
        <Route path={AppPaths.SEARCH} element={<SearchPage />} /> {/* ✅ Use constant */}
      </Route>

      {/* Admin-only route */}
      <Route
        path={AppPaths.ADMIN} // ✅ Use constant
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route
        path="*"
        element={<div className="p-6 text-center text-white">404 - Not Found</div>}
      />
    </Routes>
  );
};

export default AppRoutes;