import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLocalization } from "../Contexts/LocalizationContext";
import { Language, Video } from "../types";
import { Icon } from "./Icon";
import SearchInput from "./SearchInput";
import { useAuth } from "../Contexts/AuthContext";
import { AppPaths } from "../routes/paths";
import { useClickOutside } from "../hooks/useClickOutside";

// 🌍 Language Switcher
const languages: { code: Language; name: string }[] = [
  { code: Language.EN, name: "English" },
  { code: Language.ES, name: "Español" },
  { code: Language.FR, name: "Français" },
  { code: Language.DE, name: "Deutsch" },
  { code: Language.ZH, name: "中文" },
];

const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useClickOutside(switcherRef, () => setIsOpen(false), isOpen);

  return (
    <div ref={switcherRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="flex items-center space-x-2 text-white bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-md transition-colors duration-200 text-sm backdrop-blur-sm"
      >
        <Icon name="globe" className="w-5 h-5" />
        <span className="hidden sm:inline">{language.toUpperCase()}</span>
        <Icon
          name="chevron-down"
          className={`w-4 h-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-black/85 backdrop-blur-md border border-gray-700 rounded-md shadow-lg py-1 z-30">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm ${
                language === lang.code
                  ? "bg-red-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// 🧭 Header Component
const navLinks = [
  { name: "Home", path: AppPaths.HOME },
  { name: "Movies", path: AppPaths.MOVIES },
  { name: "Series", path: AppPaths.SERIES },
  { name: "My List", path: AppPaths.MY_LIST },
];

interface HeaderProps {
  onPlay: (video: Video) => void;
}

const Header: React.FC<HeaderProps> = ({ onPlay }) => {
  const { t } = useLocalization();
  const { isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const accountRef = useRef<HTMLDivElement>(null);

  useClickOutside(accountRef, () => setAccountOpen(false), accountOpen);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [menuOpen]);

  const isActive = (path: string) =>
    location.pathname === path
      ? "text-white font-semibold"
      : "text-gray-300 hover:text-white transition-colors";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "bg-neutral-900/90 backdrop-blur-md shadow-lg py-2"
          : "bg-gradient-to-b from-neutral-950/80 via-neutral-900/30 to-transparent py-4"
      }`}
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center px-4 md:px-8">
        {/* Logo & Nav */}
        <div className="flex items-center gap-6">
          <Link to={AppPaths.HOME} className="cursor-pointer">
            <h1 className="text-2xl md:text-3xl font-bold text-red-600 tracking-wider uppercase">
              Streamflex
            </h1>
          </Link>

          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {navLinks.map(({ name, path }) => (
                <Link key={path} to={path} className={isActive(path)}>
                  {name}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <SearchInput onPlay={onPlay} />
              <div className="hidden md:flex items-center gap-4">
                <LanguageSwitcher />
                <div ref={accountRef} className="relative">
                  <button
                    onClick={() => setAccountOpen((prev) => !prev)}
                    aria-haspopup="true"
                    aria-expanded={accountOpen}
                    className="flex items-center gap-2 bg-black/40 hover:bg-black/60 text-white text-sm px-3 py-1.5 rounded-md transition-colors duration-200 backdrop-blur-sm"
                  >
                    <Icon name="user" className="w-5 h-5" />
                    <span>Account</span>
                    <Icon
                      name="chevron-down"
                      className={`w-4 h-4 transition-transform duration-200 ${
                        accountOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {accountOpen && (
                    <div className="absolute right-0 mt-2 bg-black/85 border border-gray-700 rounded-md shadow-lg min-w-[150px] z-40">
                      <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">
                        Profile
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm hover:bg-gray-700">
                        Settings
                      </button>
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-600 text-red-400 hover:text-white"
                      >
                        {t("sign_out")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button
                className="md:hidden text-white"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? "Close menu" : "Open menu"} // ✅ Accessibility fix
              >
                <Icon name={menuOpen ? "close" : "menu"} className="w-7 h-7" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={() => navigate(AppPaths.LOGIN)}
                className="px-4 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                {t("sign_in")}
              </button>
              <button
                onClick={() => navigate(AppPaths.SIGNUP)}
                className="px-4 py-1.5 text-sm font-medium bg-black/30 hover:bg-black/50 rounded-md backdrop-blur-sm transition-colors"
              >
                {t("sign_up")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && isAuthenticated && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md z-40 flex flex-col p-6 gap-6 md:hidden">
          <button
            className="self-end text-gray-400 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            <Icon name="close" className="w-6 h-6" />
          </button>

          <nav className="flex flex-col gap-4 text-lg">
            {navLinks.map(({ name, path }) => (
              <Link
                key={path}
                to={path}
                className={isActive(path)}
                onClick={() => setMenuOpen(false)}
              >
                {name}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-4 mt-auto">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-2 text-red-400 hover:text-white bg-gray-800/50 px-3 py-2 rounded-md"
            >
              <Icon name="logout" className="w-5 h-5" />
              {t("sign_out")}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
