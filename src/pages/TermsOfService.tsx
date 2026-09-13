import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";

export default function TermsOfService() {
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
          <a href="https://junni.ca" className="nav-logo">Junni</a>
          <div className="nav-links">
            <a href="/privacy" className="nav-link">{t("terms.nav.privacy")}</a>
          </div>
        </div>
        <div className="nav-right">
          <LanguageToggle />
          <a href="/login" className="btn btn-ghost">{t("terms.nav.signIn")}</a>
        </div>
      </nav>

      {/* MAIN */}
      <main>
        <div className="policy-container">
          <h1>{t("terms.title")}</h1>
          <p className="last-updated">{t("terms.lastUpdated")}</p>

          {/* 1. Acceptance of Terms */}
          <div className="section">
            <h2>{t("terms.s1.heading")}</h2>
            <p>{t("terms.s1.p1")}</p>
            <p>{t("terms.s1.p2")}</p>
          </div>

          {/* 2. Description of the Service */}
          <div className="section">
            <h2>{t("terms.s2.heading")}</h2>
            <p>{t("terms.s2.p1")}</p>
            <p><strong>{t("terms.s2.centralPoint")}</strong></p>
          </div>

          {/* 3. Accounts, Organizations, and Team Members */}
          <div className="section">
            <h2>{t("terms.s3.heading")}</h2>
            <ul>
              <li><strong>{t("terms.s3.item1.label")}:</strong> {t("terms.s3.item1.text")}</li>
              <li><strong>{t("terms.s3.item2.label")}:</strong> {t("terms.s3.item2.text")}</li>
              <li><strong>{t("terms.s3.item3.label")}:</strong> {t("terms.s3.item3.text")}</li>
            </ul>
          </div>

          {/* 4. Customer Responsibilities */}
          <div className="section">
            <h2>{t("terms.s4.heading")}</h2>
            <ul>
              <li><strong>{t("terms.s4.item1.label")}:</strong> {t("terms.s4.item1.text")}</li>
              <li><strong>{t("terms.s4.item2.label")}:</strong> {t("terms.s4.item2.text")}</li>
              <li><strong>{t("terms.s4.item3.label")}:</strong> {t("terms.s4.item3.text")}</li>
              <li><strong>{t("terms.s4.item4.label")}:</strong> {t("terms.s4.item4.text")}</li>
            </ul>
          </div>

          {/* 5. Subscription, Fees, and Billing */}
          <div className="section">
            <h2>{t("terms.s5.heading")}</h2>
            <ul>
              <li><strong>{t("terms.s5.item1.label")}:</strong> {t("terms.s5.item1.text")}</li>
              <li><strong>{t("terms.s5.item2.label")}:</strong> {t("terms.s5.item2.text")}</li>
              <li><strong>{t("terms.s5.item3.label")}:</strong> {t("terms.s5.item3.text")}</li>
              <li><strong>{t("terms.s5.item4.label")}:</strong> {t("terms.s5.item4.text")}</li>
              <li><strong>{t("terms.s5.item5.label")}:</strong> {t("terms.s5.item5.text")}</li>
            </ul>
          </div>

          {/* 6. Acceptable Use */}
          <div className="section">
            <h2>{t("terms.s6.heading")}</h2>
            <p>{t("terms.s6.intro")}</p>
            <ul>
              <li>{t("terms.s6.item1")}</li>
              <li>{t("terms.s6.item2")}</li>
              <li>{t("terms.s6.item3")}</li>
              <li>{t("terms.s6.item4")}</li>
              <li>{t("terms.s6.item5")}</li>
              <li>{t("terms.s6.item6")}</li>
            </ul>
          </div>

          {/* 7. Intellectual Property */}
          <div className="section">
            <h2>{t("terms.s7.heading")}</h2>
            <p>{t("terms.s7.p1")}</p>
          </div>

          {/* 8. Confidentiality */}
          <div className="section">
            <h2>{t("terms.s8.heading")}</h2>
            <p>{t("terms.s8.p1")}</p>
          </div>

          {/* 9. Data Protection */}
          <div className="section">
            <h2>{t("terms.s9.heading")}</h2>
            <p>{t("terms.s9.p1")}</p>
          </div>

          {/* 10. Service Availability */}
          <div className="section">
            <h2>{t("terms.s10.heading")}</h2>
            <p>{t("terms.s10.p1")}</p>
          </div>

          {/* 11. Term and Termination */}
          <div className="section">
            <h2>{t("terms.s11.heading")}</h2>
            <p>{t("terms.s11.p1")}</p>
          </div>

          {/* LIABILITY SECTION — pending legal review, wording may be replaced */}
          <div className="section">
            <h2>{t("terms.s12.heading")}</h2>
            <p><strong>{t("terms.s12.sub1.heading")}</strong></p>
            <p>{t("terms.s12.sub1.text")}</p>
            <p><strong>{t("terms.s12.sub2.heading")}</strong></p>
            <p>{t("terms.s12.sub2.text")}</p>
            <p><strong>{t("terms.s12.sub3.heading")}</strong></p>
            <p>{t("terms.s12.sub3.text")}</p>
            <p><strong>{t("terms.s12.sub4.heading")}</strong></p>
            <p>{t("terms.s12.sub4.text")}</p>
            <p><strong>{t("terms.s12.sub5.heading")}</strong></p>
            <p>{t("terms.s12.sub5.text")}</p>
          </div>

          {/* 13. Dispute Resolution */}
          <div className="section">
            <h2>{t("terms.s13.heading")}</h2>
            <p>{t("terms.s13.p1")}</p>
            <p>{t("terms.s13.p2")}</p>
          </div>

          {/* 14. Governing Law and Jurisdiction */}
          <div className="section">
            <h2>{t("terms.s14.heading")}</h2>
            <p>{t("terms.s14.p1")}</p>
          </div>

          {/* 15. Changes to These Terms */}
          <div className="section">
            <h2>{t("terms.s15.heading")}</h2>
            <p>{t("terms.s15.p1")}</p>
          </div>

          {/* 16. Contact */}
          <div className="section">
            <h2>{t("terms.s16.heading")}</h2>
            <p>{t("terms.s16.p1")}</p>
            <p>
              <strong>{t("terms.s16.entity")}</strong><br />
              {t("terms.s16.emailLabel")} <a href="mailto:info@junni.ca">info@junni.ca</a><br />
              {t("terms.s16.addressLabel")} {t("terms.s16.address")}
            </p>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer>
        <p>{t("terms.footer")}</p>
      </footer>
    </div>
  );
}
