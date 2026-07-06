import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

const LOGO_NAVY = "/junni-logo-navy.png";
const LOGO_BEIGE = "/junni-logo-beige.png";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

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

  const { user, isAuthenticated, isLoading: auth0Loading, logout } = useAuth0();
  const [dbUser, setDbUser] = useState<any>(null);
  const [lenderBids, setLenderBids] = useState<any[]>([]);
  const [savedDeals, setSavedDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dbUser?.id) return;
    const fetchNotifications = async () => {
      const { data } = await supabase.rpc('get_notifications', { p_user_id: dbUser.id });
      setNotifications(data || []);
    };
    fetchNotifications();
  }, [dbUser?.id]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [notifOpen]);

  useEffect(() => {
    if (auth0Loading) return;
    if (!isAuthenticated || !user?.sub) { setLoading(false); return; }
    const fetchData = async () => {
      const { data: userData } = await supabase
        .from('users').select('*').eq('auth0_id', user.sub).single();
      if (!userData) { setLoading(false); return; }
      setDbUser(userData);
      const [bidsRes, savedRes] = await Promise.all([
        supabase.from('bids')
          .select('*, deals(id, title, industry, amount_requested, term_months, status, city, province, ai_score)')
          .eq('lender_id', userData.id),
        supabase.from('saved_deals')
          .select('*, deals(id, title, industry, amount_requested, term_months, interest_rate, ai_score)')
          .eq('lender_id', userData.id),
      ]);
      if (bidsRes.data) setLenderBids(bidsRes.data);
      if (savedRes.data) setSavedDeals(savedRes.data);
      setLoading(false);
    };
    fetchData();
  }, [isAuthenticated, user?.sub, auth0Loading]);

  const formatCurrency = (n: number): string => {
    if (n == null || isNaN(n)) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n.toLocaleString()}`;
  };

  const activeBids = lenderBids.filter(b => b.status === 'pending' || b.status === 'countered');
  const acceptedBids = lenderBids.filter(b => b.status === 'accepted');
  const totalDeployed = acceptedBids.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const avgRate = lenderBids.length > 0
    ? (lenderBids.reduce((sum, b) => sum + Number(b.interest_rate || 0), 0) / lenderBids.length).toFixed(1)
    : "—";
  const dealsFunded = acceptedBids.length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const lenderName = user?.name || dbUser?.full_name || "Lender";
  const lenderInitials = lenderName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const fetchNotificationsNow = async () => {
    if (!dbUser?.id) return;
    const { data } = await supabase.rpc('get_notifications', { p_user_id: dbUser.id });
    setNotifications(data || []);
  };

  const handleMarkAllRead = async () => {
    if (!dbUser?.id) return;
    await supabase.rpc('mark_all_notifications_read', { p_user_id: dbUser.id });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotifClick = async (n: any) => {
    if (!n.read) {
      await supabase.rpc('mark_notification_read', { p_notification_id: n.id });
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.link) {
      setNotifOpen(false);
      setLocation(n.link);
    }
  };

  const notifPanel = (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: 'min(320px, calc(100vw - 20px))',
      maxHeight: 400,
      background: '#fff',
      border: '1px solid #E8E2D9',
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(27,43,75,0.14)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E8E2D9', flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1B2B4B' }}>Notifications</span>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', fontSize: 12, color: '#D4940A', fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            Mark all read
          </button>
        )}
      </div>
      <div style={{ overflowY: 'auto' as const, flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' as const, color: '#7A7060', fontSize: 13 }}>No notifications yet.</div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotifClick(n)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #E8E2D9',
                background: n.read ? '#fff' : 'rgba(212,148,10,0.06)',
                cursor: n.link ? 'pointer' : 'default',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.read ? 'transparent' : '#D4940A', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1B2B4B', marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: '#7A7060', lineHeight: 1.45, marginBottom: 4 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const personas: Record<string, any> = {
    borrower: {
      sidebarLabel: "BORROWER",
      navItems: [
        { icon: "◉", text: "Dashboard", badge: null, active: true },
        { icon: "📋", text: "My Deals", badge: "2", active: false },
        { icon: "💼", text: "Bids Received", badge: "8", active: false },
        { icon: "📄", text: "Documents", badge: null, active: false },
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
        { icon: "💼", text: "My Bids", badge: activeBids.length > 0 ? String(activeBids.length) : null, active: false },
        { icon: "📊", text: "Portfolio", badge: null, active: false },
        { icon: "❤️", text: "Saved Deals", badge: null, active: false },
      ],
      accountItems: [
        { icon: "⚙️", text: "Settings", badge: null },
      ],
      userName: lenderName,
      userAvatar: lenderInitials,
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

  if (auth0Loading || loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F4", fontFamily: "Inter, sans-serif", color: "#1B2B4B", fontSize: "16px", fontWeight: 600 }}>
        Loading...
      </div>
    );
  }

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
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button className="bell" aria-label="Notifications" onClick={() => { setNotifOpen(o => !o); fetchNotificationsNow(); }}>
                🔔{unreadCount > 0 && <span className="bell-dot"></span>}
              </button>
              {notifOpen && notifPanel}
            </div>
            <button className="btn btn-gold nav-new" onClick={() => setLocation('/new-analysis')}>✦ New Analysis</button>
            <button className="btn btn-navy nav-new" onClick={() => setLocation('/marketplace')}>Browse Deals →</button>
          </div>
        </div>

        <div className={`overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

        <div className={`m-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sb-head">
            <img src={LOGO_NAVY} alt="Junni" className="sb-logo" style={{ cursor: 'pointer' }} onClick={() => setLocation('/')} />
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
          <button
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', margin: '2px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'rgba(239,68,68,0.8)', cursor: 'pointer', border: 'none', background: 'none', fontFamily: "'Inter', sans-serif", width: 'calc(100% - 20px)' }}
          >
            <span>⏻</span>Sign Out
          </button>
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
            <h2>Welcome back, {lenderName.split(" ")[0]}.</h2>
            <p>{activeBids.length > 0 ? `You have ${activeBids.length} active bid${activeBids.length !== 1 ? "s" : ""}` : "You have no active bids yet"}{totalDeployed > 0 ? ` and ${formatCurrency(totalDeployed)} deployed` : ""}{ dealsFunded > 0 ? ` across ${dealsFunded} deal${dealsFunded !== 1 ? "s" : ""}` : ""}.</p>
            <div className="welcome-actions">
              <button className="btn btn-gold" onClick={() => setLocation('/marketplace')}>Browse Marketplace →</button>
              <button className="btn btn-ghost-white">View Portfolio</button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Capital Deployed</div><div className="stat-num">{formatCurrency(totalDeployed)}</div></div>
            <div className="stat-card"><div className="stat-label">Active Bids</div><div className="stat-num gold">{activeBids.length}</div></div>
            <div className="stat-card"><div className="stat-label">Avg. Rate</div><div className="stat-num">{avgRate !== "—" ? `${avgRate}%` : "—"}</div><div className="stat-sub">weighted average</div></div>
            <div className="stat-card"><div className="stat-label">Deals Funded</div><div className="stat-num">{dealsFunded}</div></div>
          </div>

          <div>
            <div className="section-head"><div className="section-title">My Active Bids</div><button className="section-link" onClick={() => setLocation('/marketplace')}>Browse Deals</button></div>
            {lenderBids.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No bids placed yet. Browse the marketplace to get started.</div>
            ) : lenderBids.map((bid, i) => {
              const deal = bid.deals || {};
              const statusClass = bid.status === 'accepted' ? 'badge-green' : bid.status === 'countered' ? 'badge-amber' : 'badge-amber';
              const statusLabel = bid.status ? bid.status.charAt(0).toUpperCase() + bid.status.slice(1) : 'Pending';
              return (
                <div key={i} className="bid-card">
                  <div className="bid-top">
                    <div><div className="bid-company">{deal.title || "—"}</div><div className="bid-industry">{deal.industry || "—"}</div></div>
                    <div className="bid-rate">{bid.interest_rate ? `${bid.interest_rate}%` : "—"}</div>
                  </div>
                  <div className="bid-meta">
                    <div className="bid-meta-item"><span className="bid-meta-label">Amount</span><span className="bid-meta-val">{formatCurrency(Number(bid.amount || 0))}</span></div>
                    <div className="bid-meta-item"><span className="bid-meta-label">Term</span><span className="bid-meta-val">{bid.term_months ? `${bid.term_months} mo` : "—"}</span></div>
                    {deal.ai_score != null && <div className="bid-meta-item"><span className="bid-meta-label">Score</span><span className="bid-meta-val">{deal.ai_score}/100</span></div>}
                  </div>
                  <div className="bid-bottom">
                    <span className={`badge ${statusClass}`}>{statusLabel}</span>
                    <button className="bid-action" onClick={() => setLocation(`/deals/${deal.id}`)}>{bid.status === 'accepted' ? 'View' : 'View Deal'}</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="section-head"><div className="section-title">Portfolio</div></div>
            {acceptedBids.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No accepted deals yet.</div>
            ) : acceptedBids.map((bid, i) => {
              const deal = bid.deals || {};
              return (
                <div key={i} className="portfolio-card">
                  <div className="pc-company">{deal.title || "—"}</div>
                  <div className="pc-industry">{[deal.industry, deal.province].filter(Boolean).join(" · ")}</div>
                  <div className="pc-row"><span className="pc-label">Invested</span><span className="pc-val">{formatCurrency(Number(bid.amount || 0))}</span></div>
                  <div className="pc-row"><span className="pc-label">Rate</span><span className="pc-val">{bid.interest_rate ? `${bid.interest_rate}%` : "—"}</span></div>
                  <div className="pc-row"><span className="pc-label">Term</span><span className="pc-val">{bid.term_months ? `${bid.term_months} mo` : "—"}</span></div>
                  <div style={{marginTop:'8px'}}><span className="badge badge-green">Active</span></div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="section-head"><div className="section-title">Saved Deals</div><button className="section-link" onClick={() => setLocation('/marketplace')}>Browse Marketplace</button></div>
            {savedDeals.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No saved deals. Browse the marketplace to save deals you're interested in.</div>
            ) : savedDeals.map((s, i) => {
              const deal = s.deals || {};
              return (
                <div key={i} className="saved-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/deals/${deal.id}`)}>
                  <div><div className="sc-company">{deal.title || "—"}</div><div className="sc-meta">{[deal.industry, deal.province].filter(Boolean).join(" · ")}</div></div>
                  <div><div className="sc-amount">{formatCurrency(Number(deal.amount_requested || 0))}</div><div className="sc-rate">{deal.interest_rate ? `${deal.interest_rate}% proposed` : deal.ai_score != null ? `Score: ${deal.ai_score}/100` : ""}</div></div>
                </div>
              );
            })}
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
          <img src={LOGO_NAVY} alt="Junni" className="d-sb-logo" style={{ cursor: 'pointer' }} onClick={() => setLocation('/')} />
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
        <button
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', margin: '2px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'rgba(239,68,68,0.8)', cursor: 'pointer', border: 'none', background: 'none', fontFamily: "'Inter', sans-serif", width: 'calc(100% - 20px)' }}
        >
          <span>⏻</span>Sign Out
        </button>
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
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button className="d-bell" aria-label="Notifications" onClick={() => { setNotifOpen(o => !o); fetchNotificationsNow(); }}>
              🔔{unreadCount > 0 && <span className="d-bell-dot"></span>}
            </button>
            {notifOpen && notifPanel}
          </div>
          <button className="d-btn d-btn-gold" onClick={() => setLocation('/new-analysis')}>✦ New Analysis</button>
          <button className="d-btn d-btn-navy" onClick={() => setLocation('/marketplace')}>Browse Deals →</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="d-main">

        {/* WELCOME */}
        <div className="d-welcome">
          <div>
            <h2>Welcome back, {lenderName.split(" ")[0]}.</h2>
            <p>{activeBids.length > 0 ? `You have ${activeBids.length} active bid${activeBids.length !== 1 ? "s" : ""}` : "You have no active bids yet"}{totalDeployed > 0 ? ` and ${formatCurrency(totalDeployed)} deployed` : ""}{ dealsFunded > 0 ? ` across ${dealsFunded} deal${dealsFunded !== 1 ? "s" : ""}` : ""}.</p>
          </div>
          <div className="d-welcome-actions">
            <button className="d-btn d-btn-ghost-white">View Portfolio</button>
            <button className="d-btn d-btn-gold" onClick={() => setLocation('/new-analysis')}>✦ New Analysis</button>
          </div>
        </div>

        {/* STATS */}
        <div className="d-stats">
          <div className="d-stat-card"><div className="d-stat-label">Capital Deployed</div><div className="d-stat-num">{formatCurrency(totalDeployed)}</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Active Bids</div><div className="d-stat-num gold">{activeBids.length}</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Avg. Rate</div><div className="d-stat-num">{avgRate !== "—" ? `${avgRate}%` : "—"}</div><div className="d-stat-sub">weighted average</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Deals Funded</div><div className="d-stat-num">{dealsFunded}</div></div>
        </div>

        {/* ACTIVE BIDS */}
        <div className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">My Active Bids</div>
            <button className="d-btn d-btn-ghost" onClick={() => setLocation('/marketplace')}>Browse Deals</button>
          </div>
          <div className="d-bids-table">
            {lenderBids.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No bids placed yet. Browse the marketplace to get started.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Company</th><th>Industry</th><th>My Rate</th><th>My Amount</th><th>Term</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {lenderBids.map((bid, i) => {
                    const deal = bid.deals || {};
                    const statusClass = bid.status === 'accepted' ? 'badge-green' : 'badge-amber';
                    const statusLabel = bid.status ? bid.status.charAt(0).toUpperCase() + bid.status.slice(1) : 'Pending';
                    return (
                      <tr key={i}>
                        <td style={{fontWeight:600}}>{deal.title || "—"}</td>
                        <td style={{color:'var(--text-muted)'}}>{deal.industry || "—"}</td>
                        <td style={{fontWeight:700}}>{bid.interest_rate ? `${bid.interest_rate}%` : "—"}</td>
                        <td>{formatCurrency(Number(bid.amount || 0))}</td>
                        <td>{bid.term_months ? `${bid.term_months} mo` : "—"}</td>
                        <td><span className={`badge ${statusClass}`}>{statusLabel}</span></td>
                        <td><button className="d-btn d-btn-ghost" style={{fontSize:'11px',padding:'5px 10px'}} onClick={() => setLocation(`/deals/${deal.id}`)}>View</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* PORTFOLIO */}
        <div className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">Portfolio</div>
          </div>
          {acceptedBids.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No accepted deals yet.</div>
          ) : (
            <div className="d-portfolio-grid">
              {acceptedBids.map((bid, i) => {
                const deal = bid.deals || {};
                return (
                  <div key={i} className="d-portfolio-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/deals/${deal.id}`)}>
                    <div className="d-pc-company">{deal.title || "—"}</div>
                    <div className="d-pc-industry">{[deal.industry, deal.province].filter(Boolean).join(" · ")}</div>
                    <div className="d-pc-row"><span className="d-pc-label">Invested</span><span className="d-pc-val">{formatCurrency(Number(bid.amount || 0))}</span></div>
                    <div className="d-pc-row"><span className="d-pc-label">Rate</span><span className="d-pc-val">{bid.interest_rate ? `${bid.interest_rate}%` : "—"}</span></div>
                    <div className="d-pc-row"><span className="d-pc-label">Term</span><span className="d-pc-val">{bid.term_months ? `${bid.term_months} mo` : "—"}</span></div>
                    <div style={{marginTop:'10px'}}><span className="badge badge-green">Active</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SAVED DEALS */}
        <div className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">Saved Deals</div>
            <button className="d-btn d-btn-ghost" onClick={() => setLocation('/marketplace')}>Browse Marketplace</button>
          </div>
          {savedDeals.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "12px", padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>No saved deals. Browse the marketplace to save deals you're interested in.</div>
          ) : (
            <div className="d-saved-grid">
              {savedDeals.map((s, i) => {
                const deal = s.deals || {};
                return (
                  <div key={i} className="d-saved-card" style={{ cursor: "pointer" }} onClick={() => setLocation(`/deals/${deal.id}`)}>
                    <div><div className="d-sc-company">{deal.title || "—"}</div><div className="d-sc-meta">{[deal.industry, deal.province].filter(Boolean).join(" · ")}</div></div>
                    <div><div className="d-sc-amount">{formatCurrency(Number(deal.amount_requested || 0))}</div><div className="d-sc-rate">{deal.interest_rate ? `${deal.interest_rate}% proposed` : deal.ai_score != null ? `Score: ${deal.ai_score}/100` : ""}</div></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
