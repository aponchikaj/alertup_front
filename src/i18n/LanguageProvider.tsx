import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Messages } from "./messages/en";
import { ka } from "./messages/ka";

/* ============================================================================
   AlertUp i18n — English / ქართული.
   `t("home.badge")` resolves a dot path in the active dictionary, falling back
   to English, then to the key itself (so an untranslated string is visible,
   never a crash). `{name}` placeholders interpolate from the vars argument.
   ========================================================================= */

export type Language = "en" | "ka";

const STORAGE_KEY = "alertup-lang";
const DICTIONARIES: Record<Language, Messages> = { en, ka };

const resolve = (dict: Messages, path: string): string | undefined => {
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
};

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const initialLang = (): Language => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ka") return stored;
    return navigator.language?.toLowerCase().startsWith("ka") ? "ka" : "en";
  } catch {
    return "en";
  }
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Language>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable — language just won't persist */
    }
  }, [lang]);

  const setLang = useCallback((next: Language) => setLangState(next), []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const raw = resolve(DICTIONARIES[lang], key) ?? resolve(en, key) ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (match, name) =>
        name in vars ? String(vars[name]) : match,
      );
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useI18n = (): I18nContextValue => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <LanguageProvider>");
  return ctx;
};
