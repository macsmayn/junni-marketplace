import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";
import en from "../i18n/en";
import fr from "../i18n/fr";

type Lang = "en" | "fr";

const DICTS: Record<Lang, Record<string, string>> = { en, fr };

interface LanguageContextValue {
  lang:    Lang;
  setLang: (l: Lang) => void;
  t:       (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang:    "en",
  setLang: () => {},
  t:       (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth0();
  const [lang, setLangState] = useState<Lang>("en");

  // Read the user's stored language preference on auth
  useEffect(() => {
    if (!isAuthenticated || !user?.sub) return;
    supabase
      .from("users")
      .select("language")
      .eq("auth0_id", user.sub)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.language === "fr") setLangState("fr");
      });
  }, [isAuthenticated, user?.sub]);

  const setLang = (l: Lang) => {
    setLangState(l); // instant local update
    if (!user?.sub) return;
    // Persist in background — failure is non-fatal
    supabase
      .from("users")
      .update({ language: l })
      .eq("auth0_id", user.sub)
      .then(({ error }) => {
        if (error) console.error("[LanguageContext] persist failed:", error);
      });
  };

  const t = (key: string): string =>
    DICTS[lang][key] ?? DICTS.en[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
