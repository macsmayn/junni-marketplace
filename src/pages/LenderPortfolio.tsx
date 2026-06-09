import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";

const LOGO_NAVY = "/junni-logo-navy.png";

export default function LenderPortfolio() {
  const [, setLocation] = useLocation();
  const { logout } = useAuth0();
  const [persona, setPersona] = useState("lender");
  const [lang, setLang] = useState("en");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        setTopbarVisible(false);
      } else {
        setTopbarVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const personas: Record<string, any> = {
    borrower: {
      sidebarLabel: "BORROWER",
      navItems: [
        { icon: "◉", text: "Dashboard", badge: null, active: true },
        { icon: "📋", text: "My Deals", badge: "2", active: false },
        { icon: "💼", text: "Bids Received", badge: "8", active: false },
        { icon: "📄", text: "Documents", badge: null, active: false },
        { icon: "🔔", text: "Notifications", badge: null, active: false },
      ],
      accountItems: [
        { icon: "🏪", text: "Marketplace", badge: null },
        { icon: "⚙️", text: "Settings", badge: null },
      ],
      userName: "Marc Pellerin",
      userAvatar: "MP",
      userRole: "Borrower",
    },
    lender: {
      sidebarLabel: "LENDER",
      navItems: [
        { icon: "◉", text: "Dashboard", badge: null, active: false },
        { icon: "🏪", text: "Marketplace", badge: null, active: false },
        { icon: "💼", text: "My Bids", badge: "5", active: false },
        { icon: "📈", text: "Portfolio", badge: null, active: true },
        { icon: "❤️", text: "Saved Deals", badge: null, active: false },
        { icon: "🔔", text: "Notifications", badge: null, active: false },
      ],
      accountItems: [
        { icon: "⚙️", text: "Settings", badge: null },
      ],
      userName: "Jean Tremblay",
      userAvatar: "JT",
      userRole: "Lender",
    },
    admin: {
      sidebarLabel: "ADMIN",
      navItems: [
        { icon: "◉", text: "Overview", badge: null, active: true },
        { icon: "📋", text: "Deals", badge: "12", active: false },
        { icon: "👥", text: "Users", badge: null, active: false },
        { icon: "🔍", text: "KYC Review", badge: "3", active: false },
        { icon: "💼", text: "Bids", badge: null, active: false },
      ],
      accountItems: [
        { icon: "📊", text: "Analytics", badge: null },
        { icon: "⚙️", text: "Settings", badge: null },
      ],
      userName: "Admin",
      userAvatar: "A",
      userRole: "Full Access",
    },
  };

  const currentPersona = personas[persona] || personas.lender;

  // ─────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F4" }}>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --cream: #FAF8F4; --navy: #1B2B4B; --gold: #D4940A; --white: #fff;
            --border: #E8E2D9; --text-muted: #7A7060; --text-secondary: #4A4035; --green: #059669; --amber: #D97706;
          }
          html, body { background: var(--cream); color: var(--navy); font-family: 'Inter', sans-serif; }
          body { padding-top: 96px; min-height: 100vh; }

          .demo-banner { position: fixed; top: 0; left: 0; right: 0; height: 40px; background: var(--navy); z-index: 300; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; gap: 8px; }
          .demo-left { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
          .demo-dot { width: 7px; height: 7px; background: #F59E0B; border-radius: 50%; }
          .demo-label { font-size: 9px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
          .demo-pills { display: flex; gap: 3px; }
          .demo-pill { background: transparent; color: rgba(255,255,255,0.5); border: none; padding: 4px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; white-space: nowrap; }
          .demo-pill.active { background: var(--gold); color: #fff; }
          .demo-exit { background: none; border: 1px solid rgba(255,255,255,0.45); color: #fff; padding: 4px 7px; border-radius: 5px; font-size: 9px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; white-space: nowrap; flex-shrink: 0; }

          .navbar { position: fixed; top: 40px; left: 0; right: 0; height: 56px; background: #fff; border-bottom: 1px solid var(--border); z-index: 250; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; }
          .nav-left { display: flex; align-items: center; gap: 10px; }
          .hamburger { background: none; border: none; cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 4px; width: 30px; }
          .hamburger span { display: block; height: 2px; background: var(--navy); border-radius: 2px; }
          .nav-title { font-size: 15px; font-weight: 600; color: var(--navy); }
          .nav-right { display: flex; align-items: center; gap: 8px; }
          .btn { border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
          .btn-gold { background: var(--gold); color: #fff; }
          .btn-navy { background: var(--navy); color: #fff; }
          .nav-export { font-size: 12px; padding: 8px 12px; }

          .content { padding: 16px 14px 40px; display: flex; flex-direction: column; gap: 22px; }

          .port-header { background: var(--navy); border-radius: 14px; padding: 20px; }
          .port-header .overline { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
          .port-header h2 { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 16px; }
          .port-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; }
          .port-stat { padding: 14px 16px; background: rgba(255,255,255,0.03); }
          .port-stat-n { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 4px; }
          .port-stat-n .gold { color: #F5C842; }
          .port-stat-l { font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 500; }

          .perf-grid { display: grid; grid-template-columns: 1fr; gap: 11px; }
          .perf-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; }
          .perf-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 7px; }
          .perf-num { font-family: 'Fraunces', serif; font-size: 24px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
          .perf-num.green { color: var(--green); }
          .perf-sub { font-size: 10px; color: var(--text-muted); }

          .chart-wrap { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 11px; }
          .chart-title { font-size: 13px; font-weight: 700; color: var(--navy); margin-bottom: 16px; }
          .industry-bars { display: flex; flex-direction: column; gap: 11px; }
          .industry-row { display: flex; align-items: center; gap: 10px; }
          .industry-name { font-size: 12px; color: var(--text-secondary); width: 100px; flex-shrink: 0; }
          .industry-bar-wrap { flex: 1; height: 5px; background: rgba(27,43,75,0.07); border-radius: 5px; overflow: hidden; }
          .industry-bar { height: 100%; border-radius: 5px; }
          .industry-pct { font-size: 12px; font-weight: 600; color: var(--navy); width: 30px; text-align: right; flex-shrink: 0; }

          .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 11px; }
          .section-title { font-size: 15px; font-weight: 700; color: var(--navy); }
          .section-link { background: none; border: none; color: var(--gold); font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }

          .holdings-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; }
          .holdings-card:last-child { margin-bottom: 0; }
          .hc-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 3px; }
          .hc-industry { font-size: 11px; color: var(--text-muted); margin-bottom: 10px; }
          .hc-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
          .hc-label { color: var(--text-muted); }
          .hc-val { font-weight: 600; color: var(--navy); }
          .hc-status { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; display: inline-block; margin-top: 8px; }
          .s-active { background: rgba(5,150,105,0.08); color: var(--green); }
          .s-funded { background: rgba(212,148,10,0.12); color: var(--gold); }
          .s-pending { background: rgba(217,119,6,0.1); color: #D97706; }

          .overlay { position: fixed; inset: 0; background: rgba(15,27,48,0.5); z-index: 400; opacity: 0; visibility: hidden; transition: opacity 0.22s; }
          .overlay.open { opacity: 1; visibility: visible; }
          .m-sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 270px; background: var(--navy); z-index: 500; transform: translateX(-100%); transition: transform 0.26s ease; display: flex; flex-direction: column; overflow-y: auto; }
          .m-sidebar.open { transform: translateX(0); }
          .sb-head { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
          .sb-logo { height: 40px; width: auto; }
          .sb-close { background: none; border: none; color: rgba(255,255,255,0.7); font-size: 22px; cursor: pointer; line-height: 1; }
          .sb-section { padding: 16px 14px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
          .sb-item { display: flex; align-items: center; gap: 11px; padding: 11px 14px; margin: 2px 10px; border-radius: 8px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; text-decoration: none; }
          .sb-item.active { background: rgba(212,148,10,0.15); color: #F5C842; font-weight: 600; }
          .sb-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--gold); color: var(--navy); font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: auto; }
          .sb-bottom { margin-top: auto; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
          .sb-user { display: flex; align-items: center; gap: 11px; }
          .sb-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(212,148,10,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #F5C842; }
          .sb-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); }
          .sb-role { font-size: 11px; color: rgba(255,255,255,0.4); }
        `}</style>

        <div className="demo-banner">
          <div className="demo-left">
            <div className="demo-dot"></div>
            <span className="demo-label">Demo Mode</span>
          </div>
          <div className="demo-pills">
            <button className={`demo-pill ${persona === 'borrower' ? 'active' : ''}`} onClick={() => setPersona('borrower')}>Borrower</button>
            <button className={`demo-pill ${persona === 'lender' ? 'active' : ''}`} onClick={() => setPersona('lender')}>Lender</button>
            <button className={`demo-pill ${persona === 'admin' ? 'active' : ''}`} onClick={() => setPersona('admin')}>Admin</button>
          </div>
          <button className="demo-exit" onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Exit Demo</button>
        </div>

        <div className="navbar">
          <div className="nav-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <span className="nav-title">My Portfolio</span>
          </div>
          <div className="nav-right">
            <button className="btn btn-navy nav-export" onClick={() => alert("Export CSV")}>Export CSV</button>
          </div>
        </div>

        <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        <div className={`m-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sb-head">
            <img src={LOGO_NAVY} alt="Junni" className="sb-logo" />
            <button className="sb-close" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <div className="sb-section">{currentPersona.sidebarLabel}</div>
          {currentPersona.navItems.map((item: any, idx: number) => (
            <button
              key={idx}
              className={`sb-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (item.text === "Dashboard") setLocation("/lender-dashboard");
                else if (item.text === "Marketplace") setLocation("/marketplace");
                setSidebarOpen(false);
              }}
            >
              <span>{item.icon}</span>
              <span>{item.text}</span>
              {item.badge && <span className="sb-badge">{item.badge}</span>}
            </button>
          ))}
          <div className="sb-section">Account</div>
          {currentPersona.accountItems.map((item: any, idx: number) => (
            <button key={idx} className="sb-item" onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span>
              <span>{item.text}</span>
            </button>
          ))}
          <div className="sb-bottom">
            <div className="sb-user">
              <div className="sb-avatar">{currentPersona.userAvatar}</div>
              <div>
                <div className="sb-name">{currentPersona.userName}</div>
                <div className="sb-role">{currentPersona.userRole}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="content">
          <div className="port-header">
            <div className="overline">Portfolio Overview</div>
            <h2>My Portfolio</h2>
            <div className="port-stats">
              <div className="port-stat">
                <div className="port-stat-n">$<span className="gold">142K</span></div>
                <div className="port-stat-l">Total deployed</div>
              </div>
              <div className="port-stat">
                <div className="port-stat-n">7.2<span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>%</span></div>
                <div className="port-stat-l">Weighted avg. rate</div>
              </div>
              <div className="port-stat">
                <div className="port-stat-n">3</div>
                <div className="port-stat-l">Active positions</div>
              </div>
              <div className="port-stat">
                <div className="port-stat-n">1</div>
                <div className="port-stat-l">Funded (exited)</div>
              </div>
            </div>
          </div>

          <div className="perf-grid">
            <div className="perf-card">
              <div className="perf-label">Total Interest Earned</div>
              <div className="perf-num green">$8,420</div>
              <div className="perf-sub">since first deployment</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">Avg. Deal Size</div>
              <div className="perf-num">$47K</div>
              <div className="perf-sub">per position</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">Portfolio Health</div>
              <div className="perf-num green">100%</div>
              <div className="perf-sub">all deals performing</div>
            </div>
          </div>

          <div className="chart-wrap">
            <div className="chart-title">Industry Exposure</div>
            <div className="industry-bars">
              <div className="industry-row">
                <span className="industry-name">Healthcare</span>
                <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "53%", background: "var(--navy)" }}></div></div>
                <span className="industry-pct">53%</span>
              </div>
              <div className="industry-row">
                <span className="industry-name">Logistics</span>
                <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "28%", background: "#3D5A8A" }}></div></div>
                <span className="industry-pct">28%</span>
              </div>
              <div className="industry-row">
                <span className="industry-name">Retail</span>
                <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "18%", background: "var(--gold)" }}></div></div>
                <span className="industry-pct">18%</span>
              </div>
            </div>
          </div>

          <div className="chart-wrap">
            <div className="chart-title">Risk Tier Breakdown</div>
            <div className="industry-bars">
              <div className="industry-row">
                <span className="industry-name">Very Low</span>
                <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "53%", background: "var(--green)" }}></div></div>
                <span className="industry-pct">53%</span>
              </div>
              <div className="industry-row">
                <span className="industry-name">Low</span>
                <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "28%", background: "#2563EB" }}></div></div>
                <span className="industry-pct">28%</span>
              </div>
              <div className="industry-row">
                <span className="industry-name">Medium</span>
                <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "18%", background: "#D97706" }}></div></div>
                <span className="industry-pct">18%</span>
              </div>
            </div>
          </div>

          <div>
            <div className="section-head">
              <div className="section-title">Holdings</div>
              <button className="section-link" onClick={() => alert("Export CSV")}>Export CSV</button>
            </div>
            <div>
              <div className="holdings-card">
                <div className="hc-company">Prairie Health Clinics</div>
                <div className="hc-industry">Healthcare</div>
                <div className="hc-row">
                  <span className="hc-label">Invested</span>
                  <span className="hc-val">$150K</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Rate</span>
                  <span className="hc-val">7.3%</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Term Left</span>
                  <span className="hc-val">29 mo</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Repaid</span>
                  <span className="hc-val">20%</span>
                </div>
                <span className="hc-status s-active">Active</span>
              </div>
              <div className="holdings-card">
                <div className="hc-company">Cascade Logistics</div>
                <div className="hc-industry">Logistics</div>
                <div className="hc-row">
                  <span className="hc-label">Invested</span>
                  <span className="hc-val">$80K</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Rate</span>
                  <span className="hc-val">8.1%</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Term Left</span>
                  <span className="hc-val">41 mo</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Repaid</span>
                  <span className="hc-val">14%</span>
                </div>
                <span className="hc-status s-active">Active</span>
              </div>
              <div className="holdings-card">
                <div className="hc-company">Maple Ridge Mfg.</div>
                <div className="hc-industry">Manufacturing</div>
                <div className="hc-row">
                  <span className="hc-label">Invested</span>
                  <span className="hc-val">$200K</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Rate</span>
                  <span className="hc-val">6.9%</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Term Left</span>
                  <span className="hc-val">—</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Repaid</span>
                  <span className="hc-val">0%</span>
                </div>
                <span className="hc-status s-pending">Bid Pending</span>
              </div>
              <div className="holdings-card">
                <div className="hc-company">Riverdale Retail</div>
                <div className="hc-industry">Retail</div>
                <div className="hc-row">
                  <span className="hc-label">Invested</span>
                  <span className="hc-val">$50K</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Rate</span>
                  <span className="hc-val">8.8%</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Term Left</span>
                  <span className="hc-val">0 mo</span>
                </div>
                <div className="hc-row">
                  <span className="hc-label">Repaid</span>
                  <span className="hc-val">100%</span>
                </div>
                <span className="hc-status s-funded">Funded ✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ─────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", paddingTop: "40px" }}>
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
          --green: #059669;
          --gold-light: #F5C842;
        }

        /* DEMO MODE BANNER */
        .demo-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: #1B2B4B;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          gap: 24px;
        }

        .demo-left {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 1;
        }

        .demo-dot {
          width: 8px;
          height: 8px;
          background: #F59E0B;
          border-radius: 50%;
        }

        .demo-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .demo-center {
          display: flex;
          gap: 8px;
          flex: 1;
          justify-content: center;
        }

        .demo-pill {
          background: transparent;
          color: rgba(255, 255, 255, 0.5);
          border: none;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all 0.12s;
        }

        .demo-pill.active {
          background: #D4940A;
          color: #fff;
        }

        .demo-exit {
          flex: 1;
          text-align: right;
        }

        .demo-exit-btn {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: #fff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all 0.12s;
        }

        .demo-exit-btn:hover {
          border-color: rgba(255, 255, 255, 0.8);
        }

        /* SIDEBAR */
        .sidenav {
          width: 220px;
          background: #1B2B4B;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 40px;
          height: calc(100vh - 40px);
          overflow-y: auto;
          z-index: 200;
        }

        .sidenav-logo {
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .sidenav-logo img {
          height: 72px;
          width: auto;
        }

        .sidenav-section {
          padding: 16px 12px 6px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.3);
        }

        .sidenav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          margin: 2px 8px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.12s;
          text-decoration: none;
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
        }

        .sidenav-item:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.9);
        }

        .sidenav-item.active {
          background: rgba(212, 148, 10, 0.15);
          color: #F5C842;
          font-weight: 600;
        }

        .sidenav-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #D4940A;
          color: #1B2B4B;
          font-size: 10px;
          font-weight: 700;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          margin-left: auto;
        }

        .sidenav-bottom {
          margin-top: auto;
          padding: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sidenav-user {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .sidenav-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(212, 148, 10, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #F5C842;
        }

        .sidenav-name {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
        }

        .sidenav-role {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.4);
        }

        /* MAIN */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--cream);
        }

        .topbar {
          height: 56px;
          border-bottom: 1px solid var(--border);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 40px;
          z-index: 100;
          transition: transform 0.3s ease;
        }

        .topbar.hidden {
          transform: translateY(-56px);
        }

        .topbar-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--navy);
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lang-pill {
          display: flex;
          background: rgba(27, 43, 75, 0.06);
          border-radius: 100px;
          padding: 3px;
        }

        .lang-pill button {
          background: none;
          border: none;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 100px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          color: var(--text-muted);
          transition: all 0.12s;
        }

        .lang-pill button.active {
          background: var(--navy);
          color: #fff;
        }

        .btn {
          border: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.12s;
        }

        .btn-primary {
          background: var(--navy);
          color: #fff;
        }

        .btn-primary:hover {
          opacity: 0.85;
        }

        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          color: var(--navy);
        }

        .btn-ghost:hover {
          background: rgba(27, 43, 75, 0.03);
        }

        /* CONTENT */
        .content {
          padding: 28px 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* PORTFOLIO HEADER */
        .port-header {
          background: var(--navy);
          border-radius: 14px;
          padding: 28px 32px;
        }

        .port-header .overline {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 8px;
        }

        .port-header h2 {
          font-family: 'Fraunces', serif;
          font-size: 32px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -1px;
          margin-bottom: 20px;
        }

        .port-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          overflow: hidden;
        }

        .port-stat {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.03);
        }

        .port-stat-n {
          font-family: 'Fraunces', serif;
          font-size: 24px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
          margin-bottom: 4px;
        }

        .port-stat-n .gold {
          color: #F5C842;
        }

        .port-stat-l {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          font-weight: 500;
        }

        /* PERFORMANCE CARDS */
        .perf-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }

        .perf-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .perf-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .perf-num {
          font-family: 'Fraunces', serif;
          font-size: 30px;
          font-weight: 800;
          color: var(--navy);
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .perf-num.green {
          color: var(--green);
        }

        .perf-sub {
          font-size: 11px;
          color: var(--text-muted);
        }

        /* CHARTS */
        .chart-wrap {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
        }

        .chart-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 20px;
        }

        .industry-bars {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .industry-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .industry-name {
          font-size: 12px;
          color: var(--text-secondary);
          width: 140px;
          flex-shrink: 0;
        }

        .industry-bar-wrap {
          flex: 1;
          height: 6px;
          background: rgba(27, 43, 75, 0.07);
          border-radius: 6px;
          overflow: hidden;
        }

        .industry-bar {
          height: 100%;
          border-radius: 6px;
        }

        .industry-pct {
          font-size: 12px;
          font-weight: 600;
          color: var(--navy);
          width: 36px;
          text-align: right;
          flex-shrink: 0;
        }

        /* HOLDINGS TABLE */
        .section-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--navy);
        }

        .holdings-wrap {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .holdings-wrap table {
          width: 100%;
          border-collapse: collapse;
        }

        .holdings-wrap th {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-muted);
          padding: 12px 20px;
          text-align: left;
          border-bottom: 1px solid var(--border);
        }

        .holdings-wrap td {
          font-size: 13px;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          color: var(--navy);
        }

        .holdings-wrap tr:last-child td {
          border-bottom: none;
        }

        .holdings-wrap tr:hover td {
          background: rgba(27, 43, 75, 0.015);
        }

        .prog-track {
          height: 3px;
          background: rgba(27, 43, 75, 0.08);
          border-radius: 3px;
          overflow: hidden;
          width: 80px;
        }

        .prog-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--navy), #3D5A8A);
          border-radius: 3px;
        }

        .s-active {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 100px;
          background: rgba(5, 150, 105, 0.08);
          color: var(--green);
        }

        .s-funded {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 100px;
          background: rgba(212, 148, 10, 0.12);
          color: var(--gold);
        }

        .s-pending {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 100px;
          background: rgba(217, 119, 6, 0.1);
          color: #D97706;
        }

        /* CHARTS GRID */
        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 1024px) {
          .perf-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* DEMO MODE BANNER */}
      <div className="demo-banner">
        <div className="demo-left">
          <div className="demo-dot"></div>
          <div className="demo-label">Demo Mode</div>
        </div>
        <div className="demo-center">
          <button
            className={`demo-pill ${persona === "borrower" ? "active" : ""}`}
            onClick={() => setPersona("borrower")}
          >
            Borrower
          </button>
          <button
            className={`demo-pill ${persona === "lender" ? "active" : ""}`}
            onClick={() => setPersona("lender")}
          >
            Lender
          </button>
          <button
            className={`demo-pill ${persona === "admin" ? "active" : ""}`}
            onClick={() => setPersona("admin")}
          >
            Admin
          </button>
        </div>
        <div className="demo-exit">
          <button className="demo-exit-btn" onClick={() => setLocation("/")}>
            Exit Demo
          </button>
        </div>
      </div>

      {/* SIDEBAR */}
      <nav className="sidenav">
        <div className="sidenav-logo">
          <img src={LOGO_NAVY} alt="Junni" />
        </div>

        <div className="sidenav-section">{currentPersona.sidebarLabel}</div>
        {currentPersona.navItems.map((item: any, idx: number) => (
          <button
            key={idx}
            className={`sidenav-item ${item.active ? "active" : ""}`}
            onClick={() => {
              if (item.text === "Dashboard") setLocation("/lender-dashboard");
              else if (item.text === "Marketplace") setLocation("/marketplace");
            }}
          >
            <span>{item.icon}</span>
            <span>{item.text}</span>
            {item.badge && <span className="sidenav-badge">{item.badge}</span>}
          </button>
        ))}

        <div className="sidenav-section">Account</div>
        {currentPersona.accountItems.map((item: any, idx: number) => (
          <button key={idx} className="sidenav-item" onClick={() => alert("Settings")}>
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </button>
        ))}

        <div className="sidenav-bottom">
          <div className="sidenav-user">
            <div className="sidenav-avatar">{currentPersona.userAvatar}</div>
            <div>
              <div className="sidenav-name">{currentPersona.userName}</div>
              <div className="sidenav-role">{currentPersona.userRole}</div>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <div className="main">
        <div className={`topbar ${!topbarVisible ? "hidden" : ""}`}>
          <div className="topbar-title">My Portfolio</div>
          <div className="topbar-right">
            <div className="lang-pill">
              <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
                EN
              </button>
              <button className={lang === "fr" ? "active" : ""} onClick={() => setLang("fr")}>
                FR
              </button>
            </div>
            <button className="btn btn-ghost" onClick={() => alert("Export CSV")}>
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setLocation("/marketplace")}>
              Browse Deals →
            </button>
          </div>
        </div>

        <div className="content">
          {/* PORTFOLIO HEADER */}
          <div className="port-header">
            <div className="overline">Portfolio Overview</div>
            <h2>My Portfolio</h2>
            <div className="port-stats">
              <div className="port-stat">
                <div className="port-stat-n">$<span className="gold">142K</span></div>
                <div className="port-stat-l">Total deployed</div>
              </div>
              <div className="port-stat">
                <div className="port-stat-n">7.2<span style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)" }}>%</span></div>
                <div className="port-stat-l">Weighted avg. rate</div>
              </div>
              <div className="port-stat">
                <div className="port-stat-n">3</div>
                <div className="port-stat-l">Active positions</div>
              </div>
              <div className="port-stat">
                <div className="port-stat-n">1</div>
                <div className="port-stat-l">Funded (exited)</div>
              </div>
            </div>
          </div>

          {/* PERFORMANCE CARDS */}
          <div className="perf-grid">
            <div className="perf-card">
              <div className="perf-label">Total Interest Earned</div>
              <div className="perf-num green">$8,420</div>
              <div className="perf-sub">since first deployment</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">Avg. Deal Size</div>
              <div className="perf-num">$47K</div>
              <div className="perf-sub">per position</div>
            </div>
            <div className="perf-card">
              <div className="perf-label">Portfolio Health</div>
              <div className="perf-num green">100%</div>
              <div className="perf-sub">all deals performing</div>
            </div>
          </div>

          {/* EXPOSURE CHARTS */}
          <div className="charts-grid">
            <div className="chart-wrap">
              <div className="chart-title">Industry Exposure</div>
              <div className="industry-bars">
                <div className="industry-row">
                  <span className="industry-name">Healthcare</span>
                  <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "53%", background: "var(--navy)" }}></div></div>
                  <span className="industry-pct">53%</span>
                </div>
                <div className="industry-row">
                  <span className="industry-name">Logistics</span>
                  <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "28%", background: "#3D5A8A" }}></div></div>
                  <span className="industry-pct">28%</span>
                </div>
                <div className="industry-row">
                  <span className="industry-name">Retail</span>
                  <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "18%", background: "var(--gold)" }}></div></div>
                  <span className="industry-pct">18%</span>
                </div>
              </div>
            </div>
            <div className="chart-wrap">
              <div className="chart-title">Risk Tier Breakdown</div>
              <div className="industry-bars">
                <div className="industry-row">
                  <span className="industry-name">Very Low</span>
                  <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "53%", background: "var(--green)" }}></div></div>
                  <span className="industry-pct">53%</span>
                </div>
                <div className="industry-row">
                  <span className="industry-name">Low</span>
                  <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "28%", background: "#2563EB" }}></div></div>
                  <span className="industry-pct">28%</span>
                </div>
                <div className="industry-row">
                  <span className="industry-name">Medium</span>
                  <div className="industry-bar-wrap"><div className="industry-bar" style={{ width: "18%", background: "#D97706" }}></div></div>
                  <span className="industry-pct">18%</span>
                </div>
              </div>
            </div>
          </div>

          {/* HOLDINGS */}
          <div>
            <div className="section-head">
              <div className="section-title">Holdings</div>
              <button className="btn btn-ghost" onClick={() => alert("Export CSV")}>
                Export CSV
              </button>
            </div>
            <div className="holdings-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Industry</th>
                    <th>Invested</th>
                    <th>Rate</th>
                    <th>Term Left</th>
                    <th>Repaid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: "600" }}>Prairie Health Clinics</td>
                    <td style={{ color: "var(--text-muted)" }}>Healthcare</td>
                    <td style={{ fontWeight: "700" }}>$150K</td>
                    <td>7.3%</td>
                    <td>29 mo</td>
                    <td>
                      <div className="prog-track">
                        <div className="prog-fill" style={{ width: "20%" }}></div>
                      </div>
                    </td>
                    <td><span className="s-active">Active</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "600" }}>Cascade Logistics</td>
                    <td style={{ color: "var(--text-muted)" }}>Logistics</td>
                    <td style={{ fontWeight: "700" }}>$80K</td>
                    <td>8.1%</td>
                    <td>41 mo</td>
                    <td>
                      <div className="prog-track">
                        <div className="prog-fill" style={{ width: "14%" }}></div>
                      </div>
                    </td>
                    <td><span className="s-active">Active</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "600" }}>Maple Ridge Mfg.</td>
                    <td style={{ color: "var(--text-muted)" }}>Manufacturing</td>
                    <td style={{ fontWeight: "700" }}>$200K</td>
                    <td>6.9%</td>
                    <td>—</td>
                    <td>
                      <div className="prog-track">
                        <div className="prog-fill" style={{ width: "0%" }}></div>
                      </div>
                    </td>
                    <td><span className="s-pending">Bid Pending</span></td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: "600" }}>Riverdale Retail</td>
                    <td style={{ color: "var(--text-muted)" }}>Retail</td>
                    <td style={{ fontWeight: "700" }}>$50K</td>
                    <td>8.8%</td>
                    <td>0 mo</td>
                    <td>
                      <div className="prog-track">
                        <div className="prog-fill" style={{ width: "100%" }}></div>
                      </div>
                    </td>
                    <td><span className="s-funded">Funded ✓</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
