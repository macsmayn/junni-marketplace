import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";
import en from "../i18n/en";
import fr from "../i18n/fr";

type Lang = "en" | "fr";

const DICTS: Record<Lang, Record<string, string>> = { en, fr };

const LANG_KEY = "junni_lang";

function detectLang(): Lang {
  try {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param === "fr" || param === "en") {
      try { localStorage.setItem(LANG_KEY, param); } catch {}
      return param;
    }
  } catch {}
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {}
  if (typeof navigator !== "undefined" && navigator.language?.startsWith("fr")) return "fr";
  return "en";
}

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
  const [lang, setLangState] = useState<Lang>(detectLang);

  // DB takes priority: if user has a stored preference, override the detected value
  useEffect(() => {
    if (!isAuthenticated || !user?.sub) return;
    supabase
      .from("users")
      .select("language")
      .eq("auth0_id", user.sub)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.language === "fr" || data?.language === "en") {
          setLangState(data.language as Lang);
        }
      });
  }, [isAuthenticated, user?.sub]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    if (!user?.sub) return;
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
