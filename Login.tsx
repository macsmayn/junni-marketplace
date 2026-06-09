import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";

const LOGO_BEIGE = "/manus-storage/junni-logo-beige_95169244.png";

export default function Login() {
  const { loginWithRedirect, isAuthenticated } = useAuth0();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/role-select');
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginWithRedirect();
  };

  return (
    <div className="login-page">
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
          padding: 0 40px;
          z-index: 100;
        }

        nav .logo img {
          height: 72px;
          width: auto;
        }

        .login-page {
          display: flex;
          flex-direction: column;
        }

        /* ===== MAIN CONTAINER ===== */
        .login-wrapper {
          margin-top: 80px;
          min-height: calc(100vh - 80px);
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .login-left {
          background: var(--navy);
          padding: 60px 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: var(--white);
        }

        .login-left h1 {
          font-family: 'Fraunces', serif;
          font-size: 48px;
          font-weight: 900;
          margin-bottom: 20px;
          letter-spacing: -0.03em;
          line-height: 1.2;
        }

        .login-left p {
          font-family: 'Inter', sans-serif;
          font-size: 16px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.65;
          margin-bottom: 40px;
        }

        .login-features {
          list-style: none;
          gap: 20px;
          display: flex;
          flex-direction: column;
        }

        .login-features li {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.8);
        }

        .login-features li::before {
          content: '✓';
          color: var(--gold);
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
        }

        /* ===== LOGIN FORM ===== */
        .login-right {
          background: var(--white);
          padding: 60px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .login-form-header {
          margin-bottom: 40px;
        }

        .login-form-header h2 {
          font-family: 'Fraunces', serif;
          font-size: 32px;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 8px;
          letter-spacing: -0.03em;
        }

        .login-form-header p {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 400;
          color: var(--text-muted);
        }

        .form-group {
          margin-bottom: 20px;
        }

        label {
          display: block;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
          letter-spacing: 0.01em;
        }

        input[type="email"],
        input[type="password"] {
          width: 100%;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 400;
          color: var(--navy);
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        input[type="email"]:focus,
        input[type="password"]:focus {
          border-color: var(--navy);
          box-shadow: 0 0 0 3px rgba(27, 43, 75, 0.06);
        }

        input::placeholder {
          color: var(--text-muted);
        }

        .form-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          font-size: 13px;
        }

        .form-row a {
          color: var(--navy);
          text-decoration: none;
          font-weight: 600;
        }

        .form-row a:hover {
          color: var(--gold);
        }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .btn-sign-in {
          width: 100%;
          background: var(--navy);
          color: var(--white);
          border: none;
          border-radius: 8px;
          padding: 14px 24px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 16px;
        }

        .btn-sign-in:hover {
          opacity: 0.85;
        }

        .btn-sign-up {
          width: 100%;
          background: transparent;
          color: var(--navy);
          border: 1px solid var(--navy);
          border-radius: 8px;
          padding: 14px 24px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-sign-up:hover {
          background: var(--navy);
          color: var(--white);
        }

        .signup-link {
          text-align: center;
          margin-top: 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 400;
          color: var(--text-muted);
        }

        .signup-link a {
          color: var(--navy);
          font-weight: 600;
          text-decoration: none;
        }

        .signup-link a:hover {
          color: var(--gold);
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

          .login-wrapper {
            grid-template-columns: 1fr;
            display: flex;
            flex-direction: column-reverse;
          }

          .login-left {
            padding: 40px 20px;
            min-height: 300px;
          }

          .login-left h1 {
            font-size: 32px;
          }

          .login-right {
            padding: 40px 20px;
          }

          .login-form-header h2 {
            font-size: 24px;
          }
        }
      `}</style>

      {/* Navigation */}
      <nav>
        <a href="/" className="logo">
          <img src={LOGO_BEIGE} alt="Junni" />
        </a>
      </nav>

      {/* Login Container */}
      <div className="login-wrapper">
        {/* Left Panel */}
        <div className="login-left">
          <h1>Access your account.</h1>
          <p>Manage your deals, track funding progress, and monitor your portfolio in real time.</p>
          <ul className="login-features">
            <li>Real-time deal tracking</li>
            <li>Transparent bid competition</li>
            <li>Instant fund transfers</li>
            <li>24/7 dashboard access</li>
          </ul>
        </div>

        {/* Right Panel - Form */}
        <div className="login-right">
          <div className="login-form-header">
            <h2>Sign in</h2>
            <p>Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="form-row">
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="remember"
                />
                <label htmlFor="remember" style={{ marginBottom: 0, fontWeight: 400 }}>
                  Remember me
                </label>
              </div>
              <a href="#">Forgot password?</a>
            </div>

            <button type="submit" className="btn-sign-in">
              Sign In
            </button>
          </form>

          <div className="signup-link">
            Don't have an account? <a href="/role-select">Create one</a>
          </div>
        </div>
      </div>
    </div>
  );
}
