// ----------------------------
// src/Contexts/AuthContext.tsx
// ----------------------------

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authService } from "../services/authService";
import type { User } from "../types";

interface AuthContextProps {
  user: User | null;
  isAuthenticated: boolean;
  userRole: "user" | "admin" | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
        authService.logout();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []); // ✅ correct dependency array

  const login = async (email: string, password: string): Promise<User | null> => {
    const loggedUser = await authService.login(email, password);
    setUser(loggedUser);
    return loggedUser;
  };

  const signup = async (email: string, password: string): Promise<User | null> => {
    const newUser = await authService.signup(email, password);
    setUser(newUser);
    return newUser;
  };

  const logout = (): void => {
    authService.logout();
    setUser(null);
  };

  const isAuthenticated = !!user;
  const userRole = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, userRole, loading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ✅ Custom hook for consuming the context
export const useAuth = (): AuthContextProps => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
