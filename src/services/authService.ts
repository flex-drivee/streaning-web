// -------------------------
// src/services/authService.ts
// -------------------------

import type { User } from "../types";

export const authService = {
  // 🔐 Simulate backend login
  login: async (email: string, password: string): Promise<User | null> => {
    await new Promise((res) => setTimeout(res, 400));

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const fakeUser: User = {
      id: crypto.randomUUID(), // unique fake id each login
      email: email.toLowerCase().trim(), // normalize input
      role: email.includes("admin") ? "admin" : "user", // simulate role logic
      token: Math.random().toString(36).slice(2), // pseudo-random token
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour expiry
    };

    localStorage.setItem("user", JSON.stringify(fakeUser));
    return fakeUser;
  },

  // 🧾 Simulate signup (same as login for mock)
  signup: async (email: string, password: string): Promise<User | null> => {
    await new Promise((res) => setTimeout(res, 400));

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const newUser: User = {
      id: Date.now().toString(),
      email,
      role: "user",
      token: "fake-jwt-token",
      expiresAt: Date.now() + 1000 * 60 * 60,
    };

    localStorage.setItem("user", JSON.stringify(newUser));
    return newUser;
  },

  // 🚪 Log out
  logout: (): void => {
    localStorage.removeItem("user");
  },

  // 🔍 Retrieve user if still valid
  getCurrentUser: async (): Promise<User | null> => {
    await new Promise((res) => setTimeout(res, 200));

    const stored = localStorage.getItem("user");
    if (!stored) return null;

    try {
      const user = JSON.parse(stored) as User;

      // Expiry check
      if (user.expiresAt && Date.now() > user.expiresAt) {
        localStorage.removeItem("user");
        return null;
      }

      return user;
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  },
};
