const LANG_KEYS = ["zh", "en", "ja"] as const;
const LANG_LABELS: Record<string, string> = { zh: "中", en: "EN", ja: "日" };
const LANG_TITLES: Record<string, string> = { zh: "中文", en: "English", ja: "日本語" };

export function SidebarHeader() {
  const { t, i18n } = useTranslation();
  const { themeMode, setThemeMode } = useTheme();

  return (
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-bold text-gray-400 tracking-wider">VLM-AutoYOLO</span>
      <div className="flex gap-1.5 items-center">
        {/* Theme toggle */}
        <div className="flex rounded border border-gray-200 bg-gray-50 overflow-hidden h-7">
          {(["light", "dark", "system"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`flex items-center justify-center w-7 transition-colors cursor-pointer ${
                themeMode === mode
                  ? "bg-primary-500 text-white"
                  : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
              }`}
              title={t(`common.theme${mode.charAt(0).toUpperCase() + mode.slice(1)}` as never)}
            >
              <ThemeIcon mode={mode} />
            </button>
          ))}
        </div>

        {/* Language selector */}
        <div className="flex rounded border border-gray-200 bg-gray-50 overflow-hidden h-7">
          {LANG_KEYS.map((lang) => {
            const active = i18n.language.startsWith(lang);
            return (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`text-[10px] font-semibold px-1.5 transition-colors cursor-pointer ${
                  active
                    ? "bg-primary-500 text-white"
                    : "text-gray-500 hover:text-primary-600 hover:bg-gray-100"
                }`}
                title={LANG_TITLES[lang]}
              >
                {LANG_LABELS[lang]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ThemeIcon({ mode }: { mode: "light" | "dark" | "system" }) {
  if (mode === "light") {
    return (
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    );
  }
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
