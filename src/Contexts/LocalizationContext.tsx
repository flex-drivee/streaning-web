// ------------------------------
// src/Contexts/LocalizationContext.tsx
// ------------------------------
import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { Language } from "../types";

// ------------------------------
// 🌍 Translations
// ------------------------------
const translations: Record<Language, Record<string, string>> = {
  [Language.EN]: {
    play: "Play",
    download: "Download",
    subtitles: "Subtitles",
    off: "Off",
    trending_now: "Trending Now",
    action_adventure: "Action & Adventure",
    sign_in: "Sign In",
    sign_up: "Sign Up",
    sign_out: "Sign Out",
    email_address: "Email Address",
    password: "Password",
    new_to_streamflix: "New to StreamFlix?",
    sign_up_now: "Sign Up Now",
    already_have_account: "Already have an account?",
    sign_in_now: "Sign In Now",
  },

  [Language.ES]: {
    play: "Reproducir",
    download: "Descargar",
    subtitles: "Subtítulos",
    off: "Desactivado",
    trending_now: "Tendencias actuales",
    action_adventure: "Acción y Aventura",
    sign_in: "Iniciar sesión",
    sign_up: "Registrarse",
    sign_out: "Cerrar sesión",
    email_address: "Correo electrónico",
    password: "Contraseña",
    new_to_streamflix: "¿Nuevo en StreamFlix?",
    sign_up_now: "Regístrate ahora",
    already_have_account: "¿Ya tienes una cuenta?",
    sign_in_now: "Inicia sesión ahora",
  },

  [Language.FR]: {
    play: "Lire",
    download: "Télécharger",
    subtitles: "Sous-titres",
    off: "Désactivé",
    trending_now: "Tendances actuelles",
    action_adventure: "Action et Aventure",
    sign_in: "Se connecter",
    sign_up: "S'inscrire",
    sign_out: "Se déconnecter",
    email_address: "Adresse e-mail",
    password: "Mot de passe",
    new_to_streamflix: "Nouveau sur StreamFlix ?",
    sign_up_now: "Inscrivez-vous maintenant",
    already_have_account: "Vous avez déjà un compte ?",
    sign_in_now: "Connectez-vous maintenant",
  },

  [Language.DE]: {
    play: "Abspielen",
    download: "Herunterladen",
    subtitles: "Untertitel",
    off: "Aus",
    trending_now: "Aktuell im Trend",
    action_adventure: "Action & Abenteuer",
    sign_in: "Anmelden",
    sign_up: "Registrieren",
    sign_out: "Abmelden",
    email_address: "E-Mail-Adresse",
    password: "Passwort",
    new_to_streamflix: "Neu bei StreamFlix?",
    sign_up_now: "Jetzt registrieren",
    already_have_account: "Bereits ein Konto?",
    sign_in_now: "Jetzt anmelden",
  },

  [Language.ZH]: {
    play: "播放",
    download: "下载",
    subtitles: "字幕",
    off: "关闭",
    trending_now: "热门推荐",
    action_adventure: "动作与冒险",
    sign_in: "登录",
    sign_up: "注册",
    sign_out: "登出",
    email_address: "电子邮箱",
    password: "密码",
    new_to_streamflix: "新用户？",
    sign_up_now: "立即注册",
    already_have_account: "已有账户？",
    sign_in_now: "立即登录",
  },
};

// ------------------------------
// 🔤 Context Types
// ------------------------------
interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

// ------------------------------
// 🧠 Create Context
// ------------------------------
const LocalizationContext = createContext<LocalizationContextType | undefined>(
  undefined
);

// ------------------------------
// ⚙️ Provider (with persistence)
// ------------------------------
export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // 🔸 Load from localStorage or fallback to English
  const getInitialLanguage = (): Language => {
    const stored = localStorage.getItem("preferredLanguage");
    return (
      (stored && Object.values(Language).includes(stored as Language)
        ? (stored as Language)
        : Language.EN)
    );
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // 🔸 Persist on change
  useEffect(() => {
    localStorage.setItem("preferredLanguage", language);
  }, [language]);

  // 🔸 Safe setter with validation
  const setLanguage = useCallback((lang: Language) => {
    if (Object.values(Language).includes(lang)) {
      setLanguageState(lang);
    }
  }, []);

  // 🔸 Translation lookup
  const t = useCallback(
    (key: string): string => {
      const cleanKey = key.replace(/\?/g, "");
      const translation = translations[language][cleanKey];
      return translation || key;
    },
    [language]
  );

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};

// ------------------------------
// 🪶 Hook
// ------------------------------
export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error(
      "useLocalization must be used within a LocalizationProvider"
    );
  }
  return context;
};
