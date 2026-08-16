import { useLanguage } from "../contexts/LanguageContext";

const NAVY = "#1B2B4B";
const MUTED = "#7A7060";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {(["en", "fr"] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          style={{
            padding: "3px 10px", borderRadius: 99, border: "1px solid",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif",
            letterSpacing: "0.05em", textTransform: "uppercase",
            background:   lang === l ? NAVY        : "transparent",
            color:        lang === l ? "#fff"       : MUTED,
            borderColor:  lang === l ? NAVY        : "#D8D2C8",
          }}
        >{l}</button>
      ))}
    </div>
  );
}
