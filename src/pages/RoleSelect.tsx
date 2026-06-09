import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';

const LOGO_BEIGE = "/manus-storage/junni-logo-beige_95169244.png";

export default function RoleSelect() {
  const [, setLocation] = useLocation();
  const { logout, user } = useAuth0();
  const [activeRole, setActiveRole] = useState<string | null>(null);

  const upsertUser = async (role: 'borrower' | 'lender') => {
    if (!user) {
      console.error('No Auth0 user found');
      return;
    }
    console.log('Attempting upsert for:', user.sub, user.email, user.name, role);
    const { data, error } = await supabase.from('users').upsert({
      auth0_id: user.sub,
      email: user.email,
      full_name: user.name,
      role: role,
    }, { onConflict: 'auth0_id' });
    console.log('Upsert result:', data, error);
    if (error) console.error('Supabase upsert error:', error);
  };

  const handleBorrowerClick = async () => {
    setActiveRole("borrower");
    await upsertUser("borrower");
    setLocation("/onboarding");
  };

  const handleLenderClick = async () => {
    setActiveRole("lender");
    await upsertUser("lender");
    setLocation("/lender-dashboard");
  };

  return (
    <div className="role-select-page">
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --navy: #1B2B4B;
          --gold: #D4940A;
          --gold-light: #F5C842;
          --cream: #FAF8F4;
          --white: #FFFFFF;
          --border: #E8E2D9;
          --text-muted: #7A7060;
          --text-secondary: #4A4035;
          --success: #059669;
          --warning: #D97706;
          --danger: #DC2626;
          --info: #2563EB;
        }

        html, body {
          height: 100%;
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          color: var(--text-secondary);
          background-color: var(--cream);
        }

        /* ===== NAVIGATION ===== */
        nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 80px;
          background: rgba(250, 248, 244, 0.95);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          z-index: 100;
        }

        nav .logo img {
          height: 72px;
          width: auto;
        }

        nav .nav-back {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--navy);
          text-decoration: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        nav .nav-back:hover {
          color: var(--gold);
        }

        /* ===== MAIN CONTAINER ===== */
        .role-select-wrapper {
          margin-top: 80px;
          min-height: calc(100vh - 80px);
          padding: 80px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .role-select-header {
          text-align: center;
          margin-bottom: 60px;
          max-width: 600px;
        }

        .role-select-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .role-select-header h1 {
          font-family: 'Fraunces', serif;
          font-size: 48px;
          font-weight: 900;
          color: var(--navy);
          margin-bottom: 16px;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .role-select-header p {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 400;
          color: var(--text-muted);
          line-height: 1.65;
        }

        /* ===== ROLE CARDS ===== */
        .role-cards-container {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
          max-width: 900px;
          width: 100%;
        }

        .role-card {
          background: var(--white);
          border: 2px solid var(--border);
          border-radius: 12px;
          padding: 48px 40px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          text-decoration: none;
          color: inherit;
          display: block;
        }

        .role-card:hover {
          box-shadow: 0 8px 32px rgba(27, 43, 75, 0.12);
        }

        .role-card.active {
          border-color: var(--gold);
        }

        .role-card.lender {
          background: var(--navy);
          border: 2px solid var(--navy);
        }

        .role-card.lender h2,
        .role-card.lender p {
          color: var(--white);
        }

        .role-card.lender p {
          color: rgba(255, 255, 255, 0.7);
        }

        .role-card.lender .role-features li {
          color: rgba(255, 255, 255, 0.8);
        }

        .role-card.lender .role-features li::before {
          color: var(--gold);
        }

        .role-icon {
          font-size: 48px;
          margin-bottom: 20px;
        }

        .section-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--gold);
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .role-card.lender .section-label {
          color: var(--gold);
        }

        .role-card h2 {
          font-family: 'Fraunces', serif;
          font-size: 28px;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 12px;
          letter-spacing: -0.03em;
        }

        .role-card p {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 400;
          color: var(--text-muted);
          line-height: 1.65;
          margin-bottom: 24px;
        }

        .role-features {
          list-style: none;
          text-align: left;
          margin-bottom: 32px;
        }

        .role-features li {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: var(--text-secondary);
          margin-bottom: 10px;
          line-height: 1.5;
        }

        .role-features li::before {
          content: '✓';
          color: var(--success);
          font-weight: 700;
          font-size: 16px;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .role-card .btn {
          width: 100%;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: block;
        }

        .role-card .btn-borrower {
          background: var(--navy);
          color: var(--white);
        }

        .role-card .btn-borrower:hover {
          opacity: 0.85;
        }

        .role-card .btn-lender {
          background: var(--gold);
          color: var(--white);
        }

        .role-card .btn-lender:hover {
          opacity: 0.88;
        }

        /* ===== MOBILE ===== */
        @media (max-width: 768px) {
          nav {
            padding: 0 20px;
            height: 70px;
          }

          nav .logo img {
            height: 72px;
          }

          .role-select-wrapper {
            padding: 40px 20px;
            margin-top: 70px;
          }

          .role-select-header {
            margin-bottom: 40px;
          }

          .role-select-header h1 {
            font-size: 32px;
          }

          .role-select-header p {
            font-size: 14px;
          }

          .role-cards-container {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .role-card {
            padding: 40px 24px;
          }

          .role-card h2 {
            font-size: 24px;
          }
        }
      `}</style>

      {/* Navigation */}
      <nav>
        <a href="/" className="logo">
          <img src={LOGO_BEIGE} alt="Junni" />
        </a>
        <button
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          className="nav-back"
          style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", textDecoration: "none", fontSize: "inherit", fontFamily: "inherit" }}
        >
          ← Back to login
        </button>
      </nav>

      {/* Role Select Container */}
      <div className="role-select-wrapper">
        <div className="role-select-header">
          <div className="role-select-label">Welcome to Junni!</div>
          <h1>How are you joining the marketplace?</h1>
          <p>Choose your role to get started. You can always change this later in settings.</p>
        </div>

        <div className="role-cards-container">
          {/* Borrower Card */}
          <button
            type="button"
            onClick={handleBorrowerClick}
            className={`role-card borrower ${activeRole === "borrower" ? "active" : ""}`}
          >
            <div className="role-icon">🏢</div>
            <div className="section-label">For Businesses</div>
            <h2>I need funding.</h2>
            <p>Access capital by listing your deal and letting lenders compete to fund you at the best rates.</p>
            <ul className="role-features">
              <li>AI credit scoring in hours</li>
              <li>Full credit memo generated</li>
              <li>Multiple lender bids</li>
              <li>Digital closing</li>
            </ul>
            <div className="btn btn-borrower">Continue as Borrower →</div>
          </button>

          {/* Lender Card */}
          <button
            type="button"
            onClick={handleLenderClick}
            className={`role-card lender ${activeRole === "lender" ? "active" : ""}`}
          >
            <div className="role-icon">💰</div>
            <div className="section-label">For Investors</div>
            <h2>I want to deploy capital.</h2>
            <p>Browse AI-scored deals and submit competitive bids on vetted SME debt opportunities.</p>
            <ul className="role-features">
              <li>Full credit memos on every deal</li>
              <li>AI risk scoring</li>
              <li>Portfolio dashboard</li>
              <li>Counter-offer tools</li>
            </ul>
            <div className="btn btn-lender">Continue as Lender →</div>
          </button>
        </div>
      </div>
    </div>
  );
}
