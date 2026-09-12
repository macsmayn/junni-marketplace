import { useLocation } from "wouter";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#FAF8F4", color: "#1B2B4B", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cream: #FAF8F4;
          --navy: #1B2B4B;
          --gold: #D4940A;
          --white: #FFFFFF;
          --border: #E8E2D9;
          --text-muted: #7A7060;
          --text-secondary: #4A4035;
        }

        nav {
          height: 64px;
          border-bottom: 1px solid var(--border);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 40px;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          color: var(--navy);
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .nav-link {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
          cursor: pointer;
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
        }

        .nav-link:hover {
          color: var(--navy);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn {
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.12s;
          text-decoration: none;
        }

        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          color: var(--navy);
        }

        .btn-ghost:hover {
          background: rgba(27, 43, 75, 0.03);
        }

        main {
          flex: 1;
          display: flex;
          justify-content: center;
          padding: 48px 32px;
        }

        .policy-container {
          max-width: 720px;
          width: 100%;
        }

        h1 {
          font-family: 'Fraunces', serif;
          font-size: 36px;
          font-weight: 800;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        .last-updated {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 40px;
        }

        h2 {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--navy);
          margin-top: 36px;
          margin-bottom: 16px;
          letter-spacing: -0.3px;
        }

        .section:first-of-type h2 {
          margin-top: 0;
        }

        p {
          font-size: 14px;
          line-height: 1.75;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        p:last-child {
          margin-bottom: 0;
        }

        ul {
          margin-left: 20px;
          margin-bottom: 16px;
        }

        li {
          font-size: 14px;
          line-height: 1.75;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .section {
          margin-bottom: 32px;
        }

        strong {
          font-weight: 600;
        }

        a {
          color: var(--gold);
          text-decoration: none;
          font-weight: 500;
        }

        a:hover {
          text-decoration: underline;
        }

        footer {
          background: #fff;
          border-top: 1px solid var(--border);
          padding: 32px;
          text-align: center;
        }

        footer p {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
        }

        @media (max-width: 768px) {
          nav {
            padding: 0 20px;
          }
          main {
            padding: 32px 20px;
          }
          h1 {
            font-size: 28px;
          }
          h2 {
            font-size: 18px;
          }
          .nav-links {
            display: none;
          }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-left">
          <a href="/" className="nav-logo">Junni</a>
          <div className="nav-links">
            <button className="nav-link" onClick={() => alert("About")}>{t("privacy.nav.about")}</button>
            <button className="nav-link" onClick={() => setLocation("/marketplace")}>{t("privacy.nav.marketplace")}</button>
          </div>
        </div>
        <div className="nav-right">
          <LanguageToggle />
          <button className="btn btn-ghost" onClick={() => alert("Sign In")}>{t("privacy.nav.signIn")}</button>
        </div>
      </nav>

      {/* MAIN */}
      <main>
        <div className="policy-container">
          <h1>{t("privacy.title")}</h1>
          <p className="last-updated">{t("privacy.lastUpdated")}</p>

          {/* Introduction */}
          <div className="section">
            <h2>{t("privacy.intro.heading")}</h2>
            <p>{t("privacy.intro.p1")}</p>
            <p>{t("privacy.intro.p2")}</p>
          </div>

          {/* Information We Collect */}
          <div className="section">
            <h2>{t("privacy.collect.heading")}</h2>
            <p>{t("privacy.collect.intro")}</p>
            <ul>
              <li><strong>{t("privacy.collect.item1.label")}:</strong> {t("privacy.collect.item1.text")}</li>
              <li><strong>{t("privacy.collect.item2.label")}:</strong> {t("privacy.collect.item2.text")}</li>
              <li><strong>{t("privacy.collect.item3.label")}:</strong> {t("privacy.collect.item3.text")}</li>
              <li><strong>{t("privacy.collect.item4.label")}:</strong> {t("privacy.collect.item4.text")}</li>
            </ul>
          </div>

          {/* How We Use Your Information */}
          <div className="section">
            <h2>{t("privacy.use.heading")}</h2>
            <p>{t("privacy.use.intro")}</p>
            <ul>
              <li>{t("privacy.use.item1")}</li>
              <li>{t("privacy.use.item2")}</li>
              <li>{t("privacy.use.item3")}</li>
              <li>{t("privacy.use.item4")}</li>
            </ul>
            <p>{t("privacy.use.noAds")}</p>
          </div>

          {/* Service Providers */}
          <div className="section">
            <h2>{t("privacy.providers.heading")}</h2>
            <p>{t("privacy.providers.intro")}</p>
            <ul>
              <li><strong>{t("privacy.providers.supabase.label")}:</strong> {t("privacy.providers.supabase.text")}</li>
              <li><strong>{t("privacy.providers.anthropic.label")}:</strong> {t("privacy.providers.anthropic.text")}</li>
              <li><strong>{t("privacy.providers.stripe.label")}:</strong> {t("privacy.providers.stripe.text")}</li>
              <li><strong>{t("privacy.providers.resend.label")}:</strong> {t("privacy.providers.resend.text")}</li>
            </ul>
          </div>

          {/* Cross-Border Transfers */}
          <div className="section">
            <h2>{t("privacy.crossBorder.heading")}</h2>
            <p>{t("privacy.crossBorder.p1")}</p>
            <p>{t("privacy.crossBorder.p2intro")}</p>
            <ul>
              <li>{t("privacy.crossBorder.anthropic")}</li>
              <li>{t("privacy.crossBorder.stripe")}</li>
              <li>{t("privacy.crossBorder.resend")}</li>
            </ul>
            <p>{t("privacy.crossBorder.p3")}</p>
          </div>

          {/* Data Retention */}
          <div className="section">
            <h2>{t("privacy.retention.heading")}</h2>
            <p>{t("privacy.retention.intro")}</p>
            <ul>
              <li><strong>{t("privacy.retention.item1.label")}:</strong> {t("privacy.retention.item1.text")}</li>
              <li><strong>{t("privacy.retention.item2.label")}:</strong> {t("privacy.retention.item2.text")}</li>
              <li><strong>{t("privacy.retention.item3.label")}:</strong> {t("privacy.retention.item3.text")}</li>
              <li><strong>{t("privacy.retention.item4.label")}:</strong> {t("privacy.retention.item4.text")}</li>
            </ul>
          </div>

          {/* Privacy Rights */}
          <div className="section">
            <h2>{t("privacy.rights.heading")}</h2>
            <p>{t("privacy.rights.intro")}</p>
            <ul>
              <li><strong>{t("privacy.rights.item1.label")}:</strong> {t("privacy.rights.item1.text")}</li>
              <li><strong>{t("privacy.rights.item2.label")}:</strong> {t("privacy.rights.item2.text")}</li>
              <li><strong>{t("privacy.rights.item3.label")}:</strong> {t("privacy.rights.item3.text")}</li>
              <li><strong>{t("privacy.rights.item4.label")}:</strong> {t("privacy.rights.item4.text")}</li>
              <li><strong>{t("privacy.rights.item5.label")}:</strong> {t("privacy.rights.item5.text")}</li>
              <li><strong>{t("privacy.rights.item6.label")}:</strong> {t("privacy.rights.item6.text")}</li>
            </ul>
            <p>{t("privacy.rights.response")}</p>
          </div>

          {/* Automated Processing */}
          <div className="section">
            <h2>{t("privacy.automated.heading")}</h2>
            <p>{t("privacy.automated.p1")}</p>
            <p>{t("privacy.automated.p2")}</p>
          </div>

          {/* Security */}
          <div className="section">
            <h2>{t("privacy.security.heading")}</h2>
            <p>{t("privacy.security.intro")}</p>
            <ul>
              <li>{t("privacy.security.item1")}</li>
              <li>{t("privacy.security.item2")}</li>
              <li>{t("privacy.security.item3")}</li>
              <li>{t("privacy.security.item4")}</li>
            </ul>
          </div>

          {/* Contact */}
          <div className="section">
            <h2>{t("privacy.contact.heading")}</h2>
            <p>{t("privacy.contact.p1")}</p>
            <p>
              <strong>{t("privacy.contact.entity")}</strong><br />
              {t("privacy.contact.role")}<br />
              {t("privacy.contact.emailLabel")} <a href="mailto:privacy@junni.ca">privacy@junni.ca</a><br />
              {t("privacy.contact.addressLabel")} {t("privacy.contact.address")}
            </p>
            <p>{t("privacy.contact.response")}</p>
          </div>

          {/* Changes */}
          <div className="section">
            <h2>{t("privacy.changes.heading")}</h2>
            <p>{t("privacy.changes.p1")}</p>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer>
        <p>{t("privacy.footer")}</p>
      </footer>
    </div>
  );
}
