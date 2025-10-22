// src/pages/AdminPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext"; // ✅ use global auth

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth(); // ✅ no props needed

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-6">
        <h1 className="text-3xl font-bold text-red-500">Admin Dashboard</h1>
        <p className="text-gray-300">
          Welcome, Admin! 🚀 You have access to admin-only features.
        </p>

        <div className="space-x-4">
          <button
            onClick={() => navigate("/home")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
          >
            Go to Home
          </button>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
