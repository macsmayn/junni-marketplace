import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

const LOGO_NAVY = "/junni-logo-navy.png";
const LOGO_BEIGE = "/junni-logo-beige.png";

export default function LenderDashboard() {
  const [, setLocation] = useLocation();
  const [persona, setPersona] = useState("lender");
  const [lang, setLang] = useState("en");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
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
        { icon: "◉", text: "Dashboard", badge: null, active: true },
        { icon: "🏪", text: "Marketplace", badge: null, active: false },
        { icon: "💼", text: "My Bids", badge: "5", active: false },
        { icon: "📊", text: "Portfolio", badge: null, active: false },
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
            --border: #E8E2D9; --text-muted: #7A7060; --green: #059669; --amber: #D97706;
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
          .bell { background: none; border: none; font-size: 17px; cursor: pointer; position: relative; padding: 2px; }
          .bell-dot { position: absolute; top: 2px; right: 2px; width: 7px; height: 7px; background: var(--gold); border-radius: 50%; border: 1.5px solid #fff; }
          .btn { border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
          .btn-gold { background: var(--gold); color: #fff; }
          .btn-navy { background: var(--navy); color: #fff; }
          .btn-ghost-white { background: none; border: 1px solid rgba(255,255,255,0.3); color: #fff; }
          .nav-new { font-size: 12px; padding: 8px 12px; }

          .content { padding: 16px 14px 40px; display: flex; flex-direction: column; gap: 22px; }

          .welcome { background: var(--navy); border-radius: 14px; padding: 20px; }
          .welcome h2 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 5px; }
          .welcome p { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.5; margin-bottom: 16px; }
          .welcome-actions { display: flex; flex-direction: column; gap: 9px; }
          .welcome-actions .btn { padding: 11px; font-size: 13px; width: 100%; }

          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
          .stat-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; }
          .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 7px; }
          .stat-num { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; }
          .stat-num.gold { color: var(--gold); }
          .stat-sub { font-size: 10px; color: var(--text-muted); margin-top: 5px; }
          .stat-change { font-size: 10px; font-weight: 600; color: var(--green); margin-top: 5px; }

          .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 11px; }
          .section-title { font-size: 15px; font-weight: 700; color: var(--navy); }
          .section-link { background: none; border: none; color: var(--gold); font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }

          .bid-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; }
          .bid-card:last-child { margin-bottom: 0; }
          .bid-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .bid-company { font-size: 14px; font-weight: 600; color: var(--navy); }
          .bid-industry { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
          .bid-rate { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: var(--navy); }
          .bid-rate.best { color: var(--green); }
          .bid-meta { display: flex; gap: 16px; margin-bottom: 12px; }
          .bid-meta-item { display: flex; flex-direction: column; gap: 2px; }
          .bid-meta-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
          .bid-meta-val { font-size: 13px; font-weight: 600; color: var(--navy); }
          .bid-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border); }
          .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 100px; }
          .badge-green { background: rgba(5,150,105,0.08); color: var(--green); }
          .badge-amber { background: rgba(217,119,6,0.1); color: var(--amber); }
          .badge-blue { background: rgba(59,130,246,0.08); color: #2563EB; }
          .badge-gold { background: rgba(212,148,10,0.12); color: var(--gold); }
          .bid-action { font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; border: 1px solid var(--border); background: none; color: var(--navy); }

          .portfolio-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; }
          .portfolio-card:last-child { margin-bottom: 0; }
          .pc-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 2px; }
          .pc-industry { font-size: 11px; color: var(--text-muted); margin-bottom: 12px; }
          .pc-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
          .pc-label { color: var(--text-muted); }
          .pc-val { font-weight: 600; color: var(--navy); }

          .saved-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
          .saved-card:last-child { margin-bottom: 0; }
          .sc-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 3px; }
          .sc-meta { font-size: 11px; color: var(--text-muted); }
          .sc-amount { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px; text-align: right; }
          .sc-rate { font-size: 11px; color: var(--text-muted); text-align: right; }

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
          <button className="demo-exit" onClick={() => setLocation('/')}>Exit Demo</button>
        </div>

        <div className="navbar">
          <div className="nav-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <span className="nav-title">Lender Dashboard</span>
          </div>
          <div className="nav-right">
            <button className="bell" aria-label="Notifications">🔔<span className="bell-dot"></span></button>
            <button className="btn btn-navy nav-new" onClick={() => setLocation('/marketplace')}>Browse Deals →</button>
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
            <a key={idx} className={`sb-item ${item.active ? 'active' : ''}`} href="#" onClick={(e) => e.preventDefault()}>
              <span>{item.icon}</span>{item.text}
              {item.badge && <span className="sb-badge">{item.badge}</span>}
            </a>
          ))}
          <div className="sb-section">ACCOUNT</div>
          {currentPersona.accountItems.map((item: any, idx: number) => (
            <a key={idx} className="sb-item" href="#" onClick={(e) => e.preventDefault()}>
              <span>{item.icon}</span>{item.text}
            </a>
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
          <div className="welcome">
            <h2>Welcome back, Jean.</h2>
            <p>You have 5 active bids and $142K deployed across 3 deals.</p>
            <div className="welcome-actions">
              <button className="btn btn-gold" onClick={() => setLocation('/marketplace')}>Browse Marketplace →</button>
              <button className="btn btn-ghost-white">View Portfolio</button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Capital Deployed</div><div className="stat-num">$142K</div><div className="stat-change">↑ $40K this month</div></div>
            <div className="stat-card"><div className="stat-label">Active Bids</div><div className="stat-num gold">5</div><div className="stat-sub">3 pending response</div></div>
            <div className="stat-card"><div className="stat-label">Avg. Rate</div><div className="stat-num">7.2%</div><div className="stat-sub">weighted average</div></div>
            <div className="stat-card"><div className="stat-label">Deals Funded</div><div className="stat-num">3</div><div className="stat-sub">all performing</div></div>
          </div>

          <div>
            <div className="section-head"><div className="section-title">My Active Bids</div><button className="section-link" onClick={() => alert('View All Bids')}>View All</button></div>
            {[{company:'Maple Ridge Mfg.',industry:'Manufacturing',rate:'6.9%',best:true,amount:'$200K',term:'36 mo',risk:'Very Low',riskClass:'badge-green',status:'Pending',statusClass:'badge-amber'},{company:'Northern Harvest',industry:'Food & Bev',rate:'7.0%',best:false,amount:'$500K',term:'48 mo',risk:'Low',riskClass:'badge-blue',status:'Pending',statusClass:'badge-amber'},{company:'Prairie Health',industry:'Healthcare',rate:'7.3%',best:false,amount:'$150K',term:'36 mo',risk:'Very Low',riskClass:'badge-green',status:'Accepted',statusClass:'badge-green'}].map((bid,i) => (
              <div key={i} className="bid-card">
                <div className="bid-top">
                  <div><div className="bid-company">{bid.company}</div><div className="bid-industry">{bid.industry}</div></div>
                  <div className={`bid-rate${bid.best?' best':''}`}>{bid.rate}</div>
                </div>
                <div className="bid-meta">
                  <div className="bid-meta-item"><span className="bid-meta-label">Amount</span><span className="bid-meta-val">{bid.amount}</span></div>
                  <div className="bid-meta-item"><span className="bid-meta-label">Term</span><span className="bid-meta-val">{bid.term}</span></div>
                  <div className="bid-meta-item"><span className="bid-meta-label">Risk</span><span className={`badge ${bid.riskClass}`}>{bid.risk}</span></div>
                </div>
                <div className="bid-bottom">
                  <span className={`badge ${bid.statusClass}`}>{bid.status}</span>
                  <button className="bid-action" onClick={() => bid.status === 'Accepted' ? setLocation('/deals/1') : alert('Edit bid')}>{bid.status === 'Accepted' ? 'View' : 'Edit'}</button>
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="section-head"><div className="section-title">Portfolio</div><button className="section-link" onClick={() => setLocation('/lender-portfolio')}>Full Portfolio →</button></div>
            {[{company:'Prairie Health Clinics',industry:'Healthcare · Saskatchewan',invested:'$150K',rate:'7.3%',term:'29 mo remaining',status:'Active',statusClass:'badge-green'},{company:'Cascade Logistics',industry:'Logistics · Alberta',invested:'$80K',rate:'8.1%',term:'41 mo remaining',status:'Active',statusClass:'badge-green'},{company:'Riverdale Retail Group',industry:'Retail · Ontario',invested:'$50K',rate:'8.8%',term:'Completed',status:'Funded',statusClass:'badge-gold'}].map((p,i) => (
              <div key={i} className="portfolio-card">
                <div className="pc-company">{p.company}</div>
                <div className="pc-industry">{p.industry}</div>
                <div className="pc-row"><span className="pc-label">Invested</span><span className="pc-val">{p.invested}</span></div>
                <div className="pc-row"><span className="pc-label">Rate</span><span className="pc-val">{p.rate}</span></div>
                <div className="pc-row"><span className="pc-label">Term</span><span className="pc-val">{p.term}</span></div>
                <div style={{marginTop:'8px'}}><span className={`badge ${p.statusClass}`}>{p.status}</span></div>
              </div>
            ))}
          </div>

          <div>
            <div className="section-head"><div className="section-title">Saved Deals</div><button className="section-link" onClick={() => setLocation('/marketplace')}>Browse Marketplace</button></div>
            {[{company:'Atlantic Energy Partners',meta:'Energy · Nova Scotia · 55% funded',amount:'$8.5M',rate:'6.2% proposed'},{company:'Volterra Tech Solutions',meta:'Technology · Québec · 41% funded',amount:'$1.8M',rate:'9.1% proposed'}].map((s,i) => (
              <div key={i} className="saved-card">
                <div><div className="sc-company">{s.company}</div><div className="sc-meta">{s.meta}</div></div>
                <div><div className="sc-amount">{s.amount}</div><div className="sc-rate">{s.rate}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F4" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cream: #FAF8F4; --navy: #1B2B4B; --gold: #D4940A; --white: #fff;
          --border: #E8E2D9; --text-muted: #7A7060; --green: #059669; --amber: #D97706;
        }
        html, body { background: var(--cream); color: var(--navy); font-family: 'Inter', sans-serif; }

        .d-demo-banner { position: fixed; top: 0; left: 0; right: 0; height: 40px; background: var(--navy); z-index: 300; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; gap: 20px; }
        .d-demo-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .d-demo-dot { width: 7px; height: 7px; background: #F59E0B; border-radius: 50%; }
        .d-demo-label { font-size: 10px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.04em; }
        .d-demo-pills { display: flex; gap: 6px; }
        .d-demo-pill { background: transparent; color: rgba(255,255,255,0.5); border: none; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }
        .d-demo-pill.active { background: var(--gold); color: #fff; }
        .d-demo-exit { background: none; border: 1px solid rgba(255,255,255,0.5); color: #fff; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; flex-shrink: 0; }

        .d-sidebar { position: fixed; top: 40px; left: 0; width: 220px; height: calc(100vh - 40px); background: var(--navy); overflow-y: auto; z-index: 200; display: flex; flex-direction: column; }
        .d-sb-head { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .d-sb-logo { width: 120px; height: auto; display: block; }
        .d-sb-section { padding: 16px 14px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
        .d-sb-item { display: flex; align-items: center; gap: 11px; padding: 11px 14px; margin: 2px 10px; border-radius: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; text-decoration: none; border: none; background: none; font-family: 'Inter', sans-serif; width: calc(100% - 20px); }
        .d-sb-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
        .d-sb-item.active { background: rgba(212,148,10,0.15); color: #F5C842; font-weight: 600; }
        .d-sb-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--gold); color: var(--navy); font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: auto; }
        .d-sb-bottom { margin-top: auto; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
        .d-sb-user { display: flex; align-items: center; gap: 11px; }
        .d-sb-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(212,148,10,0.2); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #F5C842; flex-shrink: 0; }
        .d-sb-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); }
        .d-sb-role { font-size: 10px; color: rgba(255,255,255,0.4); }

        .d-topbar { position: fixed; top: 40px; left: 220px; right: 0; height: 60px; background: #fff; border-bottom: 1px solid var(--border); z-index: 250; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; transition: transform 0.3s ease; }
        .d-topbar.hidden { transform: translateY(-100%); }
        .d-topbar-title { font-size: 16px; font-weight: 700; color: var(--navy); }
        .d-topbar-right { display: flex; align-items: center; gap: 14px; }
        .d-lang-pill { display: flex; background: #f0f0f0; border-radius: 20px; padding: 3px; }
        .d-lang-pill button { background: none; border: none; padding: 5px 12px; font-size: 11px; font-weight: 600; cursor: pointer; border-radius: 16px; font-family: 'Inter', sans-serif; color: var(--text-muted); }
        .d-lang-pill button.active { background: #fff; color: var(--navy); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .d-bell { background: none; border: none; font-size: 18px; cursor: pointer; position: relative; padding: 2px; }
        .d-bell-dot { position: absolute; top: 0; right: 0; width: 7px; height: 7px; background: var(--gold); border-radius: 50%; border: 1.5px solid #fff; }
        .d-btn { border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
        .d-btn-gold { background: var(--gold); color: #fff; padding: 10px 16px; font-size: 13px; }
        .d-btn-navy { background: var(--navy); color: #fff; padding: 10px 16px; font-size: 13px; }
        .d-btn-ghost { background: none; border: 1px solid var(--border); color: var(--navy); padding: 7px 14px; font-size: 12px; }
        .d-btn-ghost-white { background: none; border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 10px 16px; font-size: 13px; }

        .d-main { margin-left: 220px; padding-top: 100px; padding-left: 30px; padding-right: 30px; padding-bottom: 40px; }

        .d-welcome { background: var(--navy); border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .d-welcome h2 { font-family: 'Fraunces', serif; font-size: 28px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin-bottom: 6px; }
        .d-welcome p { font-size: 14px; color: rgba(255,255,255,0.65); }
        .d-welcome-actions { display: flex; gap: 10px; flex-shrink: 0; }

        .d-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 24px; }
        .d-stat-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
        .d-stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 10px; }
        .d-stat-num { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; }
        .d-stat-num.gold { color: var(--gold); }
        .d-stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
        .d-stat-change { font-size: 11px; font-weight: 600; color: var(--green); margin-top: 6px; }

        .d-section { margin-bottom: 24px; }
        .d-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .d-section-title { font-size: 15px; font-weight: 700; color: var(--navy); }
        .d-section-link { background: none; border: none; color: var(--gold); font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }

        .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 100px; display: inline-block; }
        .badge-green { background: rgba(5,150,105,0.08); color: var(--green); }
        .badge-amber { background: rgba(217,119,6,0.1); color: var(--amber); }
        .badge-blue { background: rgba(59,130,246,0.08); color: #2563EB; }
        .badge-gold { background: rgba(212,148,10,0.12); color: var(--gold); }

        .d-bids-table { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .d-bids-table table { width: 100%; border-collapse: collapse; }
        .d-bids-table th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); padding: 12px 20px; text-align: left; border-bottom: 1px solid var(--border); }
        .d-bids-table td { font-size: 13px; padding: 14px 20px; border-bottom: 1px solid var(--border); color: var(--navy); }
        .d-bids-table tr:last-child td { border-bottom: none; }
        .d-bids-table tr:hover td { background: rgba(27,43,75,0.015); }
        .d-rate-best { font-weight: 700; color: var(--green); }

        .d-portfolio-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
        .d-portfolio-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
        .d-pc-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 3px; }
        .d-pc-industry { font-size: 11px; color: var(--text-muted); margin-bottom: 14px; }
        .d-pc-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; }
        .d-pc-label { color: var(--text-muted); }
        .d-pc-val { font-weight: 600; color: var(--navy); }

        .d-saved-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
        .d-saved-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .d-sc-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 4px; }
        .d-sc-meta { font-size: 12px; color: var(--text-muted); }
        .d-sc-amount { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px; text-align: right; margin-bottom: 3px; }
        .d-sc-rate { font-size: 12px; color: var(--text-muted); text-align: right; }
      `}</style>

      {/* DEMO BANNER */}
      <div className="d-demo-banner">
        <div className="d-demo-left">
          <div className="d-demo-dot"></div>
          <span className="d-demo-label">Demo Mode</span>
        </div>
        <div className="d-demo-pills">
          <button className={`d-demo-pill ${persona === 'borrower' ? 'active' : ''}`} onClick={() => setPersona('borrower')}>Borrower</button>
          <button className={`d-demo-pill ${persona === 'lender' ? 'active' : ''}`} onClick={() => setPersona('lender')}>Lender</button>
          <button className={`d-demo-pill ${persona === 'admin' ? 'active' : ''}`} onClick={() => setPersona('admin')}>Admin</button>
        </div>
        <button className="d-demo-exit" onClick={() => setLocation('/')}>Exit Demo</button>
      </div>

      {/* SIDEBAR */}
      <div className="d-sidebar">
        <div className="d-sb-head">
          <img src={LOGO_NAVY} alt="Junni" className="d-sb-logo" />
        </div>
        <div className="d-sb-section">{currentPersona.sidebarLabel}</div>
        {currentPersona.navItems.map((item: any, idx: number) => (
          <button key={idx} className={`d-sb-item ${item.active ? 'active' : ''}`}>
            <span>{item.icon}</span>{item.text}
            {item.badge && <span className="d-sb-badge">{item.badge}</span>}
          </button>
        ))}
        <div className="d-sb-section">ACCOUNT</div>
        {currentPersona.accountItems.map((item: any, idx: number) => (
          <button key={idx} className="d-sb-item">
            <span>{item.icon}</span>{item.text}
          </button>
        ))}
        <div className="d-sb-bottom">
          <div className="d-sb-user">
            <div className="d-sb-avatar">{currentPersona.userAvatar}</div>
            <div>
              <div className="d-sb-name">{currentPersona.userName}</div>
              <div className="d-sb-role">{currentPersona.userRole}</div>
            </div>
          </div>
        </div>
      </div>

      {/* TOPBAR */}
      <div className={`d-topbar ${!topbarVisible ? 'hidden' : ''}`}>
        <div className="d-topbar-title">Lender Dashboard</div>
        <div className="d-topbar-right">
          <div className="d-lang-pill">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'fr' ? 'active' : ''} onClick={() => setLang('fr')}>FR</button>
          </div>
          <button className="d-bell" aria-label="Notifications">🔔<span className="d-bell-dot"></span></button>
          <button className="d-btn d-btn-navy" onClick={() => setLocation('/marketplace')}>Browse Deals →</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="d-main">

        {/* WELCOME */}
        <div className="d-welcome">
          <div>
            <h2>Welcome back, Jean.</h2>
            <p>You have 5 active bids and $142K deployed across 3 deals.</p>
          </div>
          <div className="d-welcome-actions">
            <button className="d-btn d-btn-ghost-white">View Portfolio</button>
            <button className="d-btn d-btn-gold" onClick={() => setLocation('/marketplace')}>Browse Marketplace →</button>
          </div>
        </div>

        {/* STATS */}
        <div className="d-stats">
          <div className="d-stat-card"><div className="d-stat-label">Capital Deployed</div><div className="d-stat-num">$142K</div><div className="d-stat-change">↑ $40K this month</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Active Bids</div><div className="d-stat-num gold">5</div><div className="d-stat-sub">3 pending response</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Avg. Rate</div><div className="d-stat-num">7.2%</div><div className="d-stat-sub">weighted average</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Deals Funded</div><div className="d-stat-num">3</div><div className="d-stat-sub">all performing</div></div>
        </div>

        {/* ACTIVE BIDS */}
        <div className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">My Active Bids</div>
            <button className="d-btn d-btn-ghost" onClick={() => alert('View All Bids')}>View All</button>
          </div>
          <div className="d-bids-table">
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Industry</th><th>My Rate</th><th>My Amount</th><th>Term</th><th>Risk</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[{company:'Maple Ridge Mfg.',industry:'Manufacturing',rate:'6.9%',best:true,amount:'$200K',term:'36 mo',risk:'Very Low',riskClass:'badge-green',status:'Pending',statusClass:'badge-amber'},{company:'Northern Harvest',industry:'Food & Bev',rate:'7.0%',best:false,amount:'$500K',term:'48 mo',risk:'Low',riskClass:'badge-blue',status:'Pending',statusClass:'badge-amber'},{company:'Prairie Health',industry:'Healthcare',rate:'7.3%',best:false,amount:'$150K',term:'36 mo',risk:'Very Low',riskClass:'badge-green',status:'Accepted',statusClass:'badge-green'}].map((bid,i) => (
                  <tr key={i}>
                    <td style={{fontWeight:600}}>{bid.company}</td>
                    <td style={{color:'var(--text-muted)'}}>{bid.industry}</td>
                    <td className={bid.best ? 'd-rate-best' : ''} style={{fontWeight:700}}>{bid.rate}</td>
                    <td>{bid.amount}</td>
                    <td>{bid.term}</td>
                    <td><span className={`badge ${bid.riskClass}`}>{bid.risk}</span></td>
                    <td><span className={`badge ${bid.statusClass}`}>{bid.status}</span></td>
                    <td><button className="d-btn d-btn-ghost" style={{fontSize:'11px',padding:'5px 10px'}} onClick={() => bid.status === 'Accepted' ? setLocation('/deals/1') : alert('Edit bid')}>{bid.status === 'Accepted' ? 'View' : 'Edit'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PORTFOLIO */}
        <div className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">Portfolio</div>
            <button className="d-btn d-btn-ghost" onClick={() => setLocation('/lender-portfolio')}>Full Portfolio →</button>
          </div>
          <div className="d-portfolio-grid">
            {[{company:'Prairie Health Clinics',industry:'Healthcare · Saskatchewan',invested:'$150K',rate:'7.3%',term:'29 mo remaining',status:'Active',statusClass:'badge-green'},{company:'Cascade Logistics',industry:'Logistics · Alberta',invested:'$80K',rate:'8.1%',term:'41 mo remaining',status:'Active',statusClass:'badge-green'},{company:'Riverdale Retail Group',industry:'Retail · Ontario',invested:'$50K',rate:'8.8%',term:'Completed',status:'Funded',statusClass:'badge-gold'}].map((p,i) => (
              <div key={i} className="d-portfolio-card">
                <div className="d-pc-company">{p.company}</div>
                <div className="d-pc-industry">{p.industry}</div>
                <div className="d-pc-row"><span className="d-pc-label">Invested</span><span className="d-pc-val">{p.invested}</span></div>
                <div className="d-pc-row"><span className="d-pc-label">Rate</span><span className="d-pc-val">{p.rate}</span></div>
                <div className="d-pc-row"><span className="d-pc-label">Term</span><span className="d-pc-val">{p.term}</span></div>
                <div style={{marginTop:'10px'}}><span className={`badge ${p.statusClass}`}>{p.status}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* SAVED DEALS */}
        <div className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">Saved Deals</div>
            <button className="d-btn d-btn-ghost" onClick={() => setLocation('/marketplace')}>Browse Marketplace</button>
          </div>
          <div className="d-saved-grid">
            {[{company:'Atlantic Energy Partners',meta:'Energy · Nova Scotia · 55% funded',amount:'$8.5M',rate:'6.2% proposed'},{company:'Volterra Tech Solutions',meta:'Technology · Québec · 41% funded',amount:'$1.8M',rate:'9.1% proposed'}].map((s,i) => (
              <div key={i} className="d-saved-card">
                <div><div className="d-sc-company">{s.company}</div><div className="d-sc-meta">{s.meta}</div></div>
                <div><div className="d-sc-amount">{s.amount}</div><div className="d-sc-rate">{s.rate}</div></div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
