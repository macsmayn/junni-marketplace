import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useLocation } from "wouter";

/**
 * Home page — pixel-perfect conversion of Home.html (Junni Marketplace).
 * Colors: Navy #1B2B4B, Gold #D4940A, Cream #FAF8F4
 * Fonts: Fraunces (headings), Inter (body)
 *
 * All styles are scoped to this page via a local <style> tag using
 * page-specific class names prefixed where useful.
 */

const LOGO_BEIGE = "/junni-logo-beige.png";
const LOGO_NAVY = "/junni-logo-navy.png";
const DASHBOARD_MOCKUP = "/manus-storage/dashboard-mockup_c1546dbf.png";

export default function Home() {
  const { loginWithRedirect, isAuthenticated } = useAuth0();
  const [, setLocation] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<"en" | "fr">("en");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="junni-home">
      <style>{CSS}</style>

      {/* Navigation */}
      <nav id="nav" className={scrolled ? "scrolled" : ""}>
        <a href="/" className="logo">
          <img src={LOGO_BEIGE} alt="Junni" style={{ height: 72, width: "auto" }} />
        </a>
        <div className="nav-right">
          <div className="lang-toggle">
            <button
              className={lang === "en" ? "active" : ""}
              onClick={() => setLang("en")}
              type="button"
            >
              EN
            </button>
            <span style={{ color: "var(--text-muted)", margin: "0 4px" }}>|</span>
            <button
              className={lang === "fr" ? "active" : ""}
              onClick={() => setLang("fr")}
              type="button"
            >
              FR
            </button>
          </div>
          {isAuthenticated ? (
            <button
              onClick={() => setLocation('/role-select')}
              className="btn btn-ghost"
              style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer", textDecoration: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" }}
            >
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => loginWithRedirect()}
              className="btn btn-ghost"
              style={{ background: "none", border: "1px solid var(--border)", cursor: "pointer", textDecoration: "none", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "500", color: "var(--text-secondary)" }}
            >
              Sign In
            </button>
          )}
          <a href="/role-select" className="btn btn-navy">
            Apply for Funding
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-left">
          <div className="hero-label">Canada's SME Debt Marketplace</div>
          <h1>
            Capital finds the right <span className="italic-gold">deal.</span>
          </h1>
          <p className="hero-subtitle">
            Junni connects Canadian SMEs with institutional lenders competing to fund
            them. AI-scored. Transparent. 7 days.
          </p>
          <div className="hero-ctas">
            <a href="/role-select" className="btn btn-gold">
              Apply for Funding
            </a>
            <a
              href="/marketplace"
              className="btn btn-ghost"
              style={{ borderColor: "var(--white)", color: "var(--white)" }}
            >
              Browse Marketplace
            </a>
          </div>
        </div>
        <div className="hero-right">
          <img
            src={DASHBOARD_MOCKUP}
            alt="Junni dashboard preview"
            className="hero-mockup"
          />
        </div>
      </section>

      {/* Stats Bar */}
      <section className="stats-bar">
        <div className="stat-item">
          <div className="stat-value">AI Credit Scoring</div>
          <div className="stat-label">Instant analysis of your financial profile</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">Verified Lender Network</div>
          <div className="stat-label">Connect with vetted Canadian lenders</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">Secure Document Handling</div>
          <div className="stat-label">Bank-grade encryption on every upload</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">Real-Time Bidding</div>
          <div className="stat-label">Watch lenders compete for your deal live</div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="how-it-works-content">
          <div className="section-label">The Process</div>
          <h2>Three steps to funded.</h2>
          <p className="how-it-works-intro">
            From application to capital — transparent every step of the way.
          </p>
          <div className="steps-container">
            <div className="steps-grid">
              <div className="step">
                <div className="step-number">01</div>
                <h3 className="step-title">Submit your deal</h3>
                <p className="step-desc">
                  Upload financials and funding requirements. Our AI scores your business
                  and assigns an accurate risk tier within hours.
                </p>
              </div>
              <div className="step">
                <div className="step-number">02</div>
                <h3 className="step-title">Lenders compete</h3>
                <p className="step-desc">
                  Thousands of qualified lenders review your full credit memo and submit
                  bids. Competition means better terms for you.
                </p>
              </div>
              <div className="step">
                <div className="step-number">03</div>
                <h3 className="step-title">Close & get funded</h3>
                <p className="step-desc">
                  Accept the best offer, sign digitally, and receive your funds.
                  Everything tracked in one clean dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Borrower Value */}
      <section className="value-section">
        <div className="left">
          <div className="value-card">
            <h2>For Borrowers</h2>
            <ul className="value-list">
              <li>Transparent rates from multiple lenders</li>
              <li>Fast AI credit scoring, no surprises</li>
              <li>Capital in 7 days, not 7 months</li>
              <li>Rates starting at 6.2% for strong profiles</li>
            </ul>
            <a
              href="/role-select"
              className="btn btn-gold"
              style={{ width: "100%", textAlign: "center" }}
            >
              Apply for Funding
            </a>
          </div>
        </div>
        <div className="right">
          <div className="value-preview">
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Credit Score
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    background:
                      "linear-gradient(135deg, var(--gold), var(--navy))",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--white)",
                    fontFamily: "'Fraunces', serif",
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    textAlign: "center",
                    padding: 8,
                    lineHeight: 1.1,
                  }}
                >
                  AI
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--success)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Risk-Tiered Scoring
                  </div>
                  <div
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      fontWeight: 400,
                      color: "var(--text-secondary)",
                    }}
                  >
                    Clear, explainable credit assessments
                  </div>
                </div>
              </div>
            </div>
            <div style={{ paddingTop: 24, borderTop: "1px solid var(--border)" }}>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Lender Competition
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 22,
                  fontWeight: 800,
                  color: "var(--navy)",
                  letterSpacing: "-0.03em",
                  marginBottom: 4,
                }}
              >
                Multiple bids, side by side
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--text-muted)",
                  lineHeight: 1.65,
                }}
              >
                Compare offers from qualified Canadian lenders in real time.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lender Value */}
      <section className="value-section reversed">
        <div className="left">
          <div className="value-preview">
            <div
              style={{
                marginBottom: 20,
                paddingBottom: 20,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--gold)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: 8,
                }}
              >
                Portfolio Overview
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "var(--navy)",
                  letterSpacing: "-0.03em",
                }}
              >
                Diversified deal flow
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  color: "var(--text-muted)",
                  marginTop: 6,
                  lineHeight: 1.65,
                }}
              >
                Track active positions, weighted returns, and bidding activity across
                every Canadian SME deal you fund — all in one institutional-grade
                dashboard.
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 6,
                  }}
                >
                  Sectors Covered
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    lineHeight: 1.65,
                  }}
                >
                  Healthcare, Logistics, Retail, Manufacturing, and more
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 6,
                  }}
                >
                  Reporting
                </div>
                <div
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    lineHeight: 1.65,
                  }}
                >
                  Real-time portfolio analytics and exportable statements
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="right">
          <div className="value-card">
            <h2>For Lenders</h2>
            <ul className="value-list">
              <li>Institutional-grade deal sourcing</li>
              <li>Transparent bid competition on every deal</li>
              <li>Weighted returns 6.2%–8.8% per position</li>
              <li>Full portfolio analytics and reporting</li>
            </ul>
            <a
              href="/marketplace"
              className="btn btn-gold"
              style={{ width: "100%", textAlign: "center" }}
            >
              Browse Deals
            </a>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="social-proof">
        <div className="section-label">Trusted By</div>
        <h2 className="section-title">Institutions across Canada</h2>
        <div className="logos-row">
          <div className="logo-placeholder">Family Office</div>
          <div className="logo-placeholder">Credit Union</div>
          <div className="logo-placeholder">Fintech</div>
          <div className="logo-placeholder">PE Fund</div>
        </div>
        <div className="testimonials">
          <div className="testimonial-card">
            <p className="testimonial-quote">
              "Junni has transformed how we deploy capital into Canadian SMEs. The AI
              scoring is remarkably accurate and the marketplace is genuinely
              competitive."
            </p>
            <div className="testimonial-author">Sarah Chen</div>
            <div className="testimonial-role">Portfolio Manager, Cascade Capital</div>
          </div>
          <div className="testimonial-card">
            <p className="testimonial-quote">
              "We closed our funding in 6 days instead of the 4 months our traditional
              lenders said we'd need. The process was transparent and fair."
            </p>
            <div className="testimonial-author">Marc Pellerin</div>
            <div className="testimonial-role">Founder & CEO, Canadian SME Borrower</div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <h2>
          Ready to find your <span className="italic-gold">funding?</span>
        </h2>
        <div className="final-cta-buttons">
          <a href="/role-select" className="btn btn-gold">
            Apply as a Borrower
          </a>
          <a
            href="/marketplace"
            className="btn btn-ghost"
            style={{ borderColor: "var(--white)", color: "var(--white)" }}
          >
            Join as a Lender
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <a href="/" className="logo">
          <img src={LOGO_BEIGE} alt="Junni logo" style={{ height: 72, width: "auto" }} />
        </a>
        <div className="footer-links">
          <a href="/marketplace">Marketplace</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </div>
        <div className="copyright">© 2026 Junni Financial Inc.</div>
      </footer>
    </div>
  );
}

const CSS = `
.junni-home {
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

  font-family: 'Inter', sans-serif;
  font-weight: 400;
  color: var(--text-secondary);
  background-color: var(--cream);
  min-height: 100%;
}

.junni-home * { box-sizing: border-box; }
.junni-home h1, .junni-home h2, .junni-home h3, .junni-home p, .junni-home ul { margin: 0; padding: 0; }

/* ===== NAVIGATION ===== */
.junni-home nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 62px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 40px;
  z-index: 100;
  transition: background 0.3s ease;
}

.junni-home nav.scrolled {
  background: rgba(250, 248, 244, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}

.junni-home nav .logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'Fraunces', serif;
  font-weight: 800;
  color: var(--navy);
  font-size: 20px;
  text-decoration: none;
  flex-shrink: 0;
}

.junni-home nav .logo img {
  height: 50px;
  width: auto;
}

.junni-home nav .nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.junni-home .lang-toggle {
  display: flex;
  gap: 0;
  background: transparent;
  border: none;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.05em;
  align-items: center;
}

.junni-home .lang-toggle button {
  background: transparent;
  border: none;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
}

.junni-home .lang-toggle button.active {
  background: var(--navy);
  color: var(--white);
  border-radius: 100px;
}

.junni-home .btn {
  padding: 12px 24px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'Inter', sans-serif;
  text-decoration: none;
  display: inline-block;
}

.junni-home .btn-navy {
  background: var(--navy);
  color: var(--white);
}
.junni-home .btn-navy:hover { opacity: 0.85; }

.junni-home .btn-ghost {
  background: transparent;
  color: var(--navy);
  border: 1px solid var(--navy);
}
.junni-home .btn-ghost:hover {
  background: var(--navy);
  color: var(--white);
}

/* ===== HERO ===== */
.junni-home .hero {
  margin-top: 62px;
  min-height: 100vh;
  background: var(--navy);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 40px;
  padding: 60px 60px 60px 80px;
  position: relative;
  overflow: hidden;
}

.junni-home .hero-left {
  z-index: 2;
  color: var(--white);
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 0 0 45%;
  max-width: 45%;
  padding: 0;
}

.junni-home .hero-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 16px;
}

.junni-home .hero h1 {
  font-family: 'Fraunces', serif;
  font-size: 56px;
  font-weight: 900;
  line-height: 1.2;
  margin-bottom: 16px;
  letter-spacing: -0.03em;
  color: var(--white);
}

.junni-home .hero h1 .italic-gold {
  font-style: italic;
  color: var(--gold);
}

.junni-home .hero-subtitle {
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 400;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 32px;
  max-width: 500px;
}

.junni-home .hero-ctas {
  display: flex;
  gap: 12px;
}

.junni-home .btn-gold {
  background: var(--gold);
  color: var(--white);
}
.junni-home .btn-gold:hover { opacity: 0.9; }

.junni-home .hero-right {
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 0 0 55%;
  max-width: 55%;
  padding: 20px;
}

.junni-home .hero-mockup {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 40px 80px rgba(0, 0, 0, 0.55),
    0 16px 32px rgba(0, 0, 0, 0.35);
  background: var(--white);
}

.junni-home .demo-card {
  background: var(--white);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(27, 43, 75, 0.15);
  max-width: 320px;
  width: 100%;
}

.junni-home .demo-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.junni-home .demo-card-title {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 800;
  color: var(--navy);
  letter-spacing: -0.03em;
}

.junni-home .demo-card-badge {
  background: rgba(5, 150, 105, 0.08);
  color: var(--success);
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 100px;
}

.junni-home .demo-card-stat { margin-bottom: 20px; }

.junni-home .demo-card-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}

.junni-home .demo-card-value {
  font-family: 'Fraunces', serif;
  font-size: 28px;
  font-weight: 800;
  color: var(--navy);
  letter-spacing: -0.03em;
}

.junni-home .demo-progress-bar {
  height: 3px;
  background: rgba(27, 43, 75, 0.08);
  border-radius: 3px;
  margin-bottom: 8px;
  overflow: hidden;
}

.junni-home .demo-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--navy) 0%, #3D5A8A 100%);
  width: 78%;
  animation: junniFillBar 2s ease-in-out;
}

@keyframes junniFillBar {
  from { width: 0%; }
  to { width: 78%; }
}

.junni-home .demo-progress-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

/* ===== STATS BAR ===== */
.junni-home .stats-bar {
  background: var(--cream);
  padding: 40px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.junni-home .stat-item {
  text-align: left;
  padding-left: 20px;
  border-left: 2px solid var(--gold);
}

.junni-home .stat-value {
  font-family: 'Fraunces', serif;
  font-size: 32px;
  font-weight: 800;
  color: var(--gold);
  margin-bottom: 4px;
  letter-spacing: -0.03em;
}

.junni-home .stat-label {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

/* ===== HOW IT WORKS ===== */
.junni-home .how-it-works {
  background: var(--navy);
  padding: 80px 40px;
  margin: 80px 0 0 0;
}

.junni-home .how-it-works-content {
  max-width: 1200px;
  margin: 0 auto;
}

.junni-home .how-it-works .section-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 16px;
}

.junni-home .how-it-works h2 {
  font-family: 'Fraunces', serif;
  font-size: 38px;
  font-weight: 800;
  color: var(--white);
  margin-bottom: 12px;
  letter-spacing: -0.03em;
}

.junni-home .how-it-works-intro {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 32px;
  max-width: 400px;
}

.junni-home .steps-container {
  background: rgba(61, 90, 138, 0.3);
  border: 1px solid rgba(212, 148, 10, 0.2);
  border-radius: 12px;
  padding: 48px 40px;
}

.junni-home .steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 48px;
}

.junni-home .step { text-align: left; }

.junni-home .step-number {
  font-family: 'Fraunces', serif;
  font-size: 64px;
  font-weight: 800;
  color: var(--gold);
  margin-bottom: 16px;
  letter-spacing: -0.03em;
  line-height: 1;
}

.junni-home .step-title {
  font-family: 'Fraunces', serif;
  font-size: 22px;
  font-weight: 800;
  color: var(--white);
  margin-bottom: 12px;
  letter-spacing: -0.03em;
}

.junni-home .step-desc {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.65;
}

/* ===== VALUE SECTIONS ===== */
.junni-home .value-section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 40px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.junni-home .value-section.reversed { grid-template-columns: 1fr 1fr; }
.junni-home .value-section.reversed .left { order: 2; }
.junni-home .value-section.reversed .right { order: 1; }

.junni-home .value-card {
  background: var(--navy);
  padding: 40px;
  border-radius: 14px;
}

.junni-home .value-card h2 {
  font-family: 'Fraunces', serif;
  font-size: 32px;
  font-weight: 800;
  color: var(--white);
  margin-bottom: 24px;
  letter-spacing: -0.03em;
}

.junni-home .value-list {
  list-style: none;
  margin-bottom: 32px;
}

.junni-home .value-list li {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--white);
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.65;
}

.junni-home .value-list li::before {
  content: '✓';
  color: var(--gold);
  font-weight: 700;
}

.junni-home .value-preview {
  background: var(--white);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 24px rgba(27, 43, 75, 0.1);
}

/* ===== SOCIAL PROOF ===== */
.junni-home .social-proof {
  max-width: 1200px;
  margin: 0 auto;
  padding: 80px 40px;
  text-align: center;
}

.junni-home .social-proof .section-label {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--gold);
  text-transform: uppercase;
  margin-bottom: 16px;
}

.junni-home .social-proof .section-title {
  font-family: 'Fraunces', serif;
  font-size: 38px;
  font-weight: 800;
  color: var(--navy);
  margin-bottom: 40px;
  letter-spacing: -0.03em;
}

.junni-home .logos-row {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 60px;
  flex-wrap: nowrap;
}

.junni-home .logo-placeholder {
  flex: 1;
  min-width: 0;
  height: 140px;
  background: #E8E2D9;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  padding: 20px;
}

.junni-home .testimonials {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}

.junni-home .testimonial-card {
  background: var(--white);
  padding: 32px;
  border-radius: 12px;
  border: 1px solid var(--border);
  text-align: left;
}

.junni-home .testimonial-quote {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  line-height: 1.65;
  margin-bottom: 20px;
  font-style: italic;
}

.junni-home .testimonial-author {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  color: var(--navy);
  font-size: 14px;
}

.junni-home .testimonial-role {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

/* ===== FINAL CTA ===== */
.junni-home .final-cta {
  background: var(--navy);
  padding: 80px 40px;
  text-align: center;
  color: var(--white);
}

.junni-home .final-cta h2 {
  font-family: 'Fraunces', serif;
  font-size: 48px;
  font-weight: 900;
  margin-bottom: 32px;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--white);
}

.junni-home .final-cta h2 .italic-gold {
  font-style: italic;
  color: var(--gold);
}

.junni-home .final-cta-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
}

/* ===== FOOTER ===== */
.junni-home footer {
  background: var(--cream);
  padding: 40px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.junni-home footer .logo img {
  height: 72px;
  width: auto;
}

.junni-home footer .footer-links {
  display: flex;
  gap: 32px;
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  font-weight: 400;
}

.junni-home footer .footer-links a {
  color: var(--navy);
  text-decoration: none;
}

.junni-home footer .footer-links a:hover {
  color: var(--gold);
}

.junni-home footer .copyright {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

/* ===== MOBILE ===== */
@media (max-width: 900px) {
  .junni-home nav { padding: 0 20px; }
  .junni-home nav .nav-right { gap: 10px; }
  .junni-home nav .btn { padding: 8px 14px; font-size: 13px; }

  .junni-home .hero {
    flex-direction: column;
    padding: 40px 20px;
    min-height: 100vh;
    gap: 32px;
    justify-content: center;
  }

  .junni-home .hero-left,
  .junni-home .hero-right {
    flex: 0 1 auto;
    max-width: 100%;
    width: 100%;
  }

  .junni-home .hero-left {
    justify-content: flex-start;
  }

  .junni-home .hero-right { padding: 0; }

  .junni-home .hero-mockup { max-width: 720px; }

  .junni-home .hero h1 { font-size: 38px; }

  .junni-home .hero-ctas { flex-direction: column; }

  .junni-home .btn { width: 100%; text-align: center; }

  .junni-home nav .btn { width: auto; }

  .junni-home .stats-bar {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 40px 20px;
  }

  .junni-home .section-title { font-size: 28px; }

  .junni-home .steps-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }

  .junni-home .how-it-works { padding: 60px 20px; }

  .junni-home .value-section {
    display: grid !important;
    grid-template-columns: 1fr !important;
    padding: 40px 20px;
    gap: 40px;
  }

  .junni-home .value-section .left,
  .junni-home .value-section .right {
    width: 100%;
  }

  .junni-home .value-section.reversed .left { order: unset; }
  .junni-home .value-section.reversed .right { order: unset; }

  .junni-home .social-proof { padding: 60px 20px; }
  .junni-home .logos-row { flex-wrap: wrap; gap: 16px; }
  .junni-home .logo-placeholder { flex: 1 1 calc(50% - 16px); height: 100px; }

  .junni-home .testimonials { grid-template-columns: 1fr; }

  .junni-home .final-cta { padding: 60px 20px; }
  .junni-home .final-cta h2 { font-size: 32px; }
  .junni-home .final-cta-buttons { flex-direction: column; }

  .junni-home footer {
    flex-direction: column;
    gap: 24px;
    text-align: center;
    padding: 40px 20px;
  }

  .junni-home footer .footer-links { justify-content: center; flex-wrap: wrap; }
}
`;
