// src/App.tsx (wrap providers)
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./Contexts/AuthContext";
import { LocalizationProvider } from "./Contexts/LocalizationContext";
import { VideoDataProvider } from "./Contexts/VideoDataContext";

const App: React.FC = () => {
  return (
    <AuthProvider>
      <LocalizationProvider>
        <VideoDataProvider>
          <Router>
            <AppRoutes />
          </Router>
        </VideoDataProvider>
      </LocalizationProvider>
    </AuthProvider>
  );
};

export default App;
