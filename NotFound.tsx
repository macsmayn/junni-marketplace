import { useLocation } from "wouter";

const LOGO_BEIGE = "/manus-storage/junni-logo-beige_a1b2c3d4.png";

export default function NotFound() {
  const [, setLocation] = useLocation();

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

        /* NAV */
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

        .nav-logo img {
          height: 40px;
          width: auto;
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

        .btn-navy {
          background: var(--navy);
          color: #fff;
        }

        .btn-navy:hover {
          opacity: 0.88;
        }

        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          color: var(--navy);
        }

        .btn-ghost:hover {
          background: rgba(27, 43, 75, 0.03);
        }

        /* MAIN */
        main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 32px;
        }

        .error-container {
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .error-code {
          font-family: 'Fraunces', serif;
          font-size: 160px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -3px;
          margin-bottom: 16px;
        }

        .error-digit {
          display: inline-block;
        }

        .error-digit.gold {
          color: var(--gold);
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }

        .error-title {
          font-family: 'Fraunces', serif;
          font-size: 32px;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }

        .error-desc {
          font-size: 15px;
          color: var(--text-muted);
          margin-bottom: 32px;
          line-height: 1.6;
        }

        .error-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 48px;
          justify-content: center;
        }

        .error-buttons .btn {
          padding: 10px 20px;
          font-size: 13px;
        }

        .quick-links-label {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .quick-links {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .quick-link {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 20px;
          text-decoration: none;
          transition: all 0.2s;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .quick-link:hover {
          border-color: var(--gold);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .quick-link-icon {
          font-size: 28px;
          margin-bottom: 12px;
        }

        .quick-link-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
          margin-bottom: 4px;
        }

        .quick-link-sub {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* FOOTER */
        footer {
          background: #fff;
          border-top: 1px solid var(--border);
          padding: 32px;
          text-align: center;
        }

        footer p {
          font-size: 12px;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          nav {
            padding: 0 20px;
          }
          main {
            padding: 40px 20px;
          }
          .error-code {
            font-size: 100px;
          }
          .error-title {
            font-size: 24px;
          }
          .error-buttons {
            flex-direction: column;
          }
          .quick-links {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-left">
          <a href="/" className="nav-logo">
            <img src={LOGO_BEIGE} alt="Junni" style={{ height: "40px", width: "auto" }} />
          </a>
        </div>
        <div className="nav-right">
          <button className="btn btn-ghost" onClick={() => alert("Sign In")}>
            Sign In
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main>
        <div className="error-container">
          <div className="error-code">
            <span className="error-digit">4</span>
            <span className="error-digit gold">0</span>
            <span className="error-digit">4</span>
          </div>
          <h1 className="error-title">This page doesn't exist.</h1>
          <p className="error-desc">
            We couldn't find what you're looking for. The page may have been moved, deleted, or the URL might be incorrect.
          </p>

          <div className="error-buttons">
            <button className="btn btn-navy" onClick={() => setLocation("/")}>
              ← Go Home
            </button>
            <button className="btn btn-ghost" onClick={() => setLocation("/marketplace")}>
              Browse Marketplace
            </button>
          </div>

          <div className="quick-links-label">Or go to</div>
          <div className="quick-links">
            <button
              className="quick-link"
              onClick={() => setLocation("/marketplace")}
              style={{ border: "1px solid #E8E2D9", background: "#fff", borderRadius: "10px", padding: "20px", textDecoration: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              <div className="quick-link-icon">📊</div>
              <div className="quick-link-label">Marketplace</div>
              <div className="quick-link-sub">Browse active deals</div>
            </button>
            <button
              className="quick-link"
              onClick={() => setLocation("/dashboard")}
              style={{ border: "1px solid #E8E2D9", background: "#fff", borderRadius: "10px", padding: "20px", textDecoration: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              <div className="quick-link-icon">📈</div>
              <div className="quick-link-label">Dashboard</div>
              <div className="quick-link-sub">Your account overview</div>
            </button>
            <button
              className="quick-link"
              onClick={() => setLocation("/apply")}
              style={{ border: "1px solid #E8E2D9", background: "#fff", borderRadius: "10px", padding: "20px", textDecoration: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              <div className="quick-link-icon">📝</div>
              <div className="quick-link-label">Apply</div>
              <div className="quick-link-sub">Start your application</div>
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer>
        <p>&copy; 2025 Junni Marketplace. All rights reserved.</p>
      </footer>
    </div>
  );
}
