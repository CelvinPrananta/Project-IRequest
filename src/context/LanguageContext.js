import { createContext, useState, useEffect, useCallback, useMemo } from "react";

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem("language") || "en");

  const changeLanguage = useCallback((lang) => {
    localStorage.setItem("language", lang);
    setLanguage(lang);
    window.dispatchEvent(new Event("languageChanged"));
  }, []);

  useEffect(() => {
    const handleLanguageChange = () => {
      setLanguage(localStorage.getItem("language") || "en");
    };

    window.addEventListener("languageChanged", handleLanguageChange);

    // Jika bahasa diubah dari tab lain
    window.addEventListener("storage", handleLanguageChange);

    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange);
      window.removeEventListener("storage", handleLanguageChange);
    };
  }, []);

  const value = useMemo(() => ({ language, changeLanguage }), [language, changeLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};