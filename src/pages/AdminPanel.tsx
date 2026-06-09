import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

const LOGO_NAVY = "/manus-storage/junni-logo-navy_28bfc256.png";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const [persona, setPersona] = useState("admin");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
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
        { icon: "📈", text: "Portfolio", badge: null, active: false },
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

  const currentPersona = personas[persona] || personas.admin;

  const dealsData = [
    { company: "Maple Ridge Mfg.", borrower: "Marc Pellerin", amount: "$3.2M", risk: "Very Low", riskBadge: "b-active", score: "8.4", status: "Active", statusBadge: "b-active", submitted: "Mar 12" },
    { company: "Volterra Tech", borrower: "Sophie Bélanger", amount: "$1.8M", risk: "Medium", riskBadge: "b-review", score: "6.1", status: "Pending Review", statusBadge: "b-review", submitted: "Apr 14" },
    { company: "Prairie Health", borrower: "David Park", amount: "$2.1M", risk: "Very Low", riskBadge: "b-active", score: "8.8", status: "KYC Pending", statusBadge: "b-kyc", submitted: "Apr 10" },
    { company: "Northern Harvest", borrower: "Isabelle Roy", amount: "$5.0M", risk: "Low", riskBadge: "b-active", score: "7.9", status: "Active", statusBadge: "b-active", submitted: "Mar 28" },
    { company: "Atlantic Energy", borrower: "Thomas Leblanc", amount: "$8.5M", risk: "Low", riskBadge: "b-review", score: "7.2", status: "Funded", statusBadge: "b-funded", submitted: "Feb 18" },
    { company: "Cascade Logistics", borrower: "Alex Chen", amount: "$4.2M", risk: "Very Low", riskBadge: "b-active", score: "8.6", status: "Active", statusBadge: "b-active", submitted: "Apr 2" },
  ];

  const usersData = [
    { name: "Marc Pellerin", email: "marc@mapleridge.ca", role: "Borrower", roleBadge: "b-borrower", joined: "Jan 15, 2025", kyc: "Approved", kycBadge: "b-approved", deals: "2" },
    { name: "Jean Tremblay", email: "jean@investjunni.ca", role: "Lender", roleBadge: "b-lender", joined: "Feb 3, 2025", kyc: "Approved", kycBadge: "b-approved", deals: "5" },
    { name: "Sophie Bélanger", email: "sophie@volterra.ca", role: "Borrower", roleBadge: "b-borrower", joined: "Mar 22, 2025", kyc: "Pending", kycBadge: "b-pending", deals: "1" },
    { name: "David Park", email: "david@prairie-health.ca", role: "Borrower", roleBadge: "b-borrower", joined: "Apr 1, 2025", kyc: "Pending", kycBadge: "b-pending", deals: "1" },
    { name: "Isabelle Roy", email: "isabelle@northernharvest.ca", role: "Borrower", roleBadge: "b-borrower", joined: "Mar 10, 2025", kyc: "Approved", kycBadge: "b-approved", deals: "1" },
  ];

  const kycData = [
    {
      company: "Volterra Tech",
      borrower: "Sophie Bélanger",
      submitted: "Apr 14, 2025",
      docs: [
        { name: "Business License", status: "pending" },
        { name: "Tax ID / CRA Number", status: "uploaded" },
        { name: "Bank Statement", status: "pending" },
      ],
    },
    {
      company: "Prairie Health",
      borrower: "David Park",
      submitted: "Apr 10, 2025",
      docs: [
        { name: "Business License", status: "uploaded" },
        { name: "Tax ID / CRA Number", status: "uploaded" },
        { name: "Bank Statement", status: "uploaded" },
      ],
    },
    {
      company: "Cascade Logistics",
      borrower: "Alex Chen",
      submitted: "Apr 8, 2025",
      docs: [
        { name: "Business License", status: "uploaded" },
        { name: "Tax ID / CRA Number", status: "pending" },
        { name: "Bank Statement", status: "uploaded" },
      ],
    },
  ];

  const bidsData = [
    { deal: "Maple Ridge Mfg.", lender: "Lender #4821", rate: "6.9%", amount: "$200K", term: "36 mo", submitted: "Apr 15", status: "Accepted", statusBadge: "b-active" },
    { deal: "Maple Ridge Mfg.", lender: "Lender #2194", rate: "7.1%", amount: "$300K", term: "36 mo", submitted: "Apr 15", status: "Pending", statusBadge: "b-review" },
    { deal: "Northern Harvest", lender: "Lender #5502", rate: "7.0%", amount: "$500K", term: "48 mo", submitted: "Apr 12", status: "Accepted", statusBadge: "b-active" },
    { deal: "Atlantic Energy", lender: "Lender #1203", rate: "6.5%", amount: "$2.0M", term: "60 mo", submitted: "Apr 8", status: "Accepted", statusBadge: "b-active" },
    { deal: "Prairie Health", lender: "Lender #7845", rate: "7.3%", amount: "$500K", term: "36 mo", submitted: "Apr 14", status: "Pending", statusBadge: "b-review" },
  ];

  // ─────────────────────────────────────────────
  // SHARED TAB CONTENT
  // ─────────────────────────────────────────────
  const renderTabContent = (mobile: boolean) => {
    const tableStyle = mobile ? { fontSize: '11px' } : {};
    const thPad = mobile ? '10px 10px' : '12px 16px';
    const tdPad = mobile ? '10px 10px' : '12px 16px';

    if (activeTab === 0) return (
      <div style={{ background: '#fff', border: '1px solid #E8E2D9', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...tableStyle }}>
          <thead>
            <tr>
              {['Company','Borrower','Amount','Risk','Score','Status','Submitted','Actions'].map(h => (
                <th key={h} style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#7A7060', padding:thPad, textAlign:'left', borderBottom:'1px solid #E8E2D9', background:'rgba(27,43,75,0.02)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dealsData.map((deal, idx) => (
              <tr key={idx} style={{ borderBottom: idx < dealsData.length-1 ? '1px solid #E8E2D9' : 'none' }}>
                <td style={{ padding:tdPad, fontWeight:600, color:'#1B2B4B' }}>{deal.company}</td>
                <td style={{ padding:tdPad, color:'#7A7060' }}>{deal.borrower}</td>
                <td style={{ padding:tdPad, fontWeight:600, color:'#1B2B4B' }}>{deal.amount}</td>
                <td style={{ padding:tdPad }}><span className={`badge ${deal.riskBadge}`}>{deal.risk}</span></td>
                <td style={{ padding:tdPad, fontWeight:700, color:'#1B2B4B' }}>{deal.score}</td>
                <td style={{ padding:tdPad }}><span className={`badge ${deal.statusBadge}`}>{deal.status}</span></td>
                <td style={{ padding:tdPad, color:'#7A7060' }}>{deal.submitted}</td>
                <td style={{ padding:tdPad }}><button className="a-btn a-btn-ghost" onClick={() => setLocation('/deals/1')}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    if (activeTab === 1) return (
      <div style={{ background: '#fff', border: '1px solid #E8E2D9', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...tableStyle }}>
          <thead>
            <tr>
              {['Name','Email','Role','Joined','KYC Status','Deals','Actions'].map(h => (
                <th key={h} style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#7A7060', padding:thPad, textAlign:'left', borderBottom:'1px solid #E8E2D9', background:'rgba(27,43,75,0.02)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usersData.map((user, idx) => (
              <tr key={idx} style={{ borderBottom: idx < usersData.length-1 ? '1px solid #E8E2D9' : 'none' }}>
                <td style={{ padding:tdPad, fontWeight:600, color:'#1B2B4B' }}>{user.name}</td>
                <td style={{ padding:tdPad, color:'#7A7060' }}>{user.email}</td>
                <td style={{ padding:tdPad }}><span className={`badge ${user.roleBadge}`}>{user.role}</span></td>
                <td style={{ padding:tdPad, color:'#7A7060' }}>{user.joined}</td>
                <td style={{ padding:tdPad }}><span className={`badge ${user.kycBadge}`}>{user.kyc}</span></td>
                <td style={{ padding:tdPad, color:'#1B2B4B' }}>{user.deals}</td>
                <td style={{ padding:tdPad }}><button className="a-btn a-btn-ghost" onClick={() => alert('View user')}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    if (activeTab === 2) return (
      <div style={{ display:'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)', gap:'14px' }}>
        {kycData.map((kyc, idx) => (
          <div key={idx} style={{ background:'#fff', border:'1px solid #E8E2D9', borderRadius:'12px', padding:'20px' }}>
            <div style={{ fontSize:'14px', fontWeight:600, color:'#1B2B4B', marginBottom:'3px' }}>{kyc.company}</div>
            <div style={{ fontSize:'12px', color:'#7A7060', marginBottom:'4px' }}>{kyc.borrower}</div>
            <div style={{ fontSize:'11px', color:'#7A7060', marginBottom:'14px' }}>Submitted {kyc.submitted}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'14px' }}>
              {kyc.docs.map((doc, docIdx) => (
                <div key={docIdx} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px', background:'rgba(27,43,75,0.03)', borderRadius:'6px', fontSize:'12px' }}>
                  <span style={{ width:'18px', height:'18px', borderRadius:'50%', background: doc.status === 'uploaded' ? '#059669' : '#D97706', color:'#fff', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, flexShrink:0 }}>
                    {doc.status === 'uploaded' ? '✓' : '⏳'}
                  </span>
                  <span style={{ color:'#1B2B4B' }}>{doc.name}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'6px', paddingTop:'12px', borderTop:'1px solid #E8E2D9', flexWrap:'wrap' }}>
              <button className="a-btn a-btn-green" onClick={() => alert('Approve KYC')}>Approve KYC</button>
              <button className="a-btn a-btn-red" onClick={() => alert('Reject')}>Reject</button>
              <button className="a-btn a-btn-ghost" onClick={() => alert('View Documents')}>View Docs</button>
            </div>
          </div>
        ))}
      </div>
    );

    if (activeTab === 3) return (
      <div style={{ background: '#fff', border: '1px solid #E8E2D9', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...tableStyle }}>
          <thead>
            <tr>
              {['Deal','Lender','Rate','Amount','Term','Submitted','Status'].map(h => (
                <th key={h} style={{ fontSize:'11px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#7A7060', padding:thPad, textAlign:'left', borderBottom:'1px solid #E8E2D9', background:'rgba(27,43,75,0.02)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bidsData.map((bid, idx) => (
              <tr key={idx} style={{ borderBottom: idx < bidsData.length-1 ? '1px solid #E8E2D9' : 'none' }}>
                <td style={{ padding:tdPad, fontWeight:600, color:'#1B2B4B' }}>{bid.deal}</td>
                <td style={{ padding:tdPad, color:'#7A7060' }}>{bid.lender}</td>
                <td style={{ padding:tdPad, fontWeight:700, color:'#1B2B4B' }}>{bid.rate}</td>
                <td style={{ padding:tdPad, color:'#1B2B4B' }}>{bid.amount}</td>
                <td style={{ padding:tdPad, color:'#1B2B4B' }}>{bid.term}</td>
                <td style={{ padding:tdPad, color:'#7A7060' }}>{bid.submitted}</td>
                <td style={{ padding:tdPad }}><span className={`badge ${bid.statusBadge}`}>{bid.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return null;
  };

  // ─────────────────────────────────────────────
  // MOBILE LAYOUT
  // ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F4" }}>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root { --cream: #FAF8F4; --navy: #1B2B4B; --gold: #D4940A; --border: #E8E2D9; --text-muted: #7A7060; --green: #059669; --red: #DC2626; }
          html, body { background: var(--cream); font-family: 'Inter', sans-serif; }
          body { padding-top: 96px; }

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

          .content { padding: 16px 14px 40px; display: flex; flex-direction: column; gap: 18px; }

          .alert-bar { background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15); border-radius: 10px; padding: 12px 14px; }
          .alert-bar p { font-size: 12px; font-weight: 600; color: var(--red); margin-bottom: 2px; }
          .alert-bar span { font-size: 11px; color: var(--text-muted); }

          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .stat-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
          .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 6px; }
          .stat-num { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; }
          .stat-num.gold { color: var(--gold); }
          .stat-num.red { color: var(--red); }
          .stat-sub { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

          .tabs { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; margin-bottom: 14px; }
          .tab { padding: 9px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); cursor: pointer; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; font-family: 'Inter', sans-serif; white-space: nowrap; }
          .tab.active { color: var(--navy); border-bottom-color: var(--navy); }
          .tab-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--red); color: #fff; font-size: 9px; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; margin-left: 3px; }

          .badge { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 100px; font-size: 9px; font-weight: 700; }
          .b-active { background: rgba(5,150,105,0.08); color: #059669; }
          .b-review { background: rgba(217,119,6,0.1); color: #D97706; }
          .b-kyc { background: rgba(59,130,246,0.08); color: #2563EB; }
          .b-funded { background: rgba(212,148,10,0.12); color: var(--gold); }
          .b-borrower { background: rgba(212,148,10,0.1); color: var(--gold); }
          .b-lender { background: rgba(59,130,246,0.08); color: #2563EB; }
          .b-pending { background: rgba(27,43,75,0.07); color: var(--navy); }
          .b-approved { background: rgba(5,150,105,0.08); color: #059669; }

          .a-btn { border: none; border-radius: 7px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; font-size: 11px; padding: 6px 10px; }
          .a-btn-ghost { background: none; border: 1px solid var(--border); color: var(--navy); }
          .a-btn-green { background: #059669; color: #fff; }
          .a-btn-red { background: #DC2626; color: #fff; }
          .a-btn-navy { background: var(--navy); color: #fff; }

          .overlay { position: fixed; inset: 0; background: rgba(15,27,48,0.5); z-index: 400; opacity: 0; visibility: hidden; transition: opacity 0.22s; }
          .overlay.open { opacity: 1; visibility: visible; }
          .m-sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 270px; background: #0F1B30; z-index: 500; transform: translateX(-100%); transition: transform 0.26s ease; display: flex; flex-direction: column; overflow-y: auto; }
          .m-sidebar.open { transform: translateX(0); }
          .sb-head { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
          .sb-logo { height: 40px; width: auto; }
          .sb-close { background: none; border: none; color: rgba(255,255,255,0.7); font-size: 22px; cursor: pointer; }
          .sb-section { padding: 16px 14px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
          .sb-item { display: flex; align-items: center; gap: 11px; padding: 11px 14px; margin: 2px 10px; border-radius: 8px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; }
          .sb-item.active { background: rgba(212,148,10,0.15); color: #F5C842; font-weight: 600; }
          .sb-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--gold); color: var(--navy); font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: auto; }
          .sb-bottom { margin-top: auto; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
          .sb-user { display: flex; align-items: center; gap: 11px; }
          .sb-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(212,148,10,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #F5C842; }
          .sb-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); }
          .sb-role { font-size: 11px; color: rgba(255,255,255,0.4); }
        `}</style>

        <div className="demo-banner">
          <div className="demo-left"><div className="demo-dot"></div><span className="demo-label">Demo Mode</span></div>
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
            <span className="nav-title">Admin Panel</span>
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
            <button key={idx} className={`sb-item ${item.active ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span><span>{item.text}</span>
              {item.badge && <span className="sb-badge">{item.badge}</span>}
            </button>
          ))}
          <div className="sb-section">Platform</div>
          {currentPersona.accountItems.map((item: any, idx: number) => (
            <button key={idx} className="sb-item" onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span><span>{item.text}</span>
            </button>
          ))}
          <div className="sb-bottom">
            <div className="sb-user">
              <div className="sb-avatar">{currentPersona.userAvatar}</div>
              <div><div className="sb-name">{currentPersona.userName}</div><div className="sb-role">{currentPersona.userRole}</div></div>
            </div>
          </div>
        </div>

        <div className="content">
          <div className="alert-bar">
            <p>⚠ 3 deals pending KYC review</p>
            <span>Action required before deals go live</span>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Total Users</div><div className="stat-num">1,842</div><div className="stat-sub">+24 this week</div></div>
            <div className="stat-card"><div className="stat-label">Active Deals</div><div className="stat-num gold">38</div><div className="stat-sub">12 pending review</div></div>
            <div className="stat-card"><div className="stat-label">Capital Deployed</div><div className="stat-num">$450M</div><div className="stat-sub">all time</div></div>
            <div className="stat-card"><div className="stat-label">KYC Pending</div><div className="stat-num red">3</div><div className="stat-sub">needs review</div></div>
            <div className="stat-card"><div className="stat-label">Platform Fee</div><div className="stat-num">2.5%</div><div className="stat-sub">per deal</div></div>
          </div>
          <div>
            <div className="tabs">
              <button className={`tab ${activeTab === 0 ? 'active' : ''}`} onClick={() => setActiveTab(0)}>Deals</button>
              <button className={`tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>Users</button>
              <button className={`tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>KYC <span className="tab-badge">3</span></button>
              <button className={`tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>Bids</button>
            </div>
            {renderTabContent(true)}
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
        :root { --cream: #FAF8F4; --navy: #1B2B4B; --gold: #D4940A; --border: #E8E2D9; --text-muted: #7A7060; --green: #059669; --red: #DC2626; }
        html, body { background: var(--cream); font-family: 'Inter', sans-serif; }

        .d-demo-banner { position: fixed; top: 0; left: 0; right: 0; height: 40px; background: var(--navy); z-index: 300; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; gap: 20px; }
        .d-demo-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .d-demo-dot { width: 7px; height: 7px; background: #F59E0B; border-radius: 50%; }
        .d-demo-label { font-size: 10px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.04em; }
        .d-demo-pills { display: flex; gap: 6px; }
        .d-demo-pill { background: transparent; color: rgba(255,255,255,0.5); border: none; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }
        .d-demo-pill.active { background: var(--gold); color: #fff; }
        .d-demo-exit { background: none; border: 1px solid rgba(255,255,255,0.5); color: #fff; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; flex-shrink: 0; }

        .d-sidebar { position: fixed; top: 40px; left: 0; width: 220px; height: calc(100vh - 40px); background: #0F1B30; overflow-y: auto; z-index: 200; display: flex; flex-direction: column; }
        .d-sb-head { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); position: relative; }
        .d-sb-logo { width: 120px; height: auto; display: block; }
        .d-admin-badge { position: absolute; top: 10px; right: 10px; background: rgba(212,148,10,0.2); color: #F5C842; font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .d-sb-section { padding: 16px 14px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
        .d-sb-item { display: flex; align-items: center; gap: 11px; padding: 11px 14px; margin: 2px 10px; border-radius: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; width: calc(100% - 20px); }
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
        .d-topbar-right { display: flex; align-items: center; gap: 10px; }

        .a-btn { border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
        .a-btn-ghost { background: none; border: 1px solid var(--border); color: var(--navy); padding: 8px 14px; font-size: 12px; }
        .a-btn-navy { background: var(--navy); color: #fff; padding: 8px 14px; font-size: 12px; }
        .a-btn-green { background: #059669; color: #fff; padding: 7px 12px; font-size: 11px; }
        .a-btn-red { background: #DC2626; color: #fff; padding: 7px 12px; font-size: 11px; }

        .d-main { margin-left: 220px; padding-top: 100px; padding-left: 30px; padding-right: 30px; padding-bottom: 40px; }

        .d-alert { background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .d-alert-text { font-size: 13px; font-weight: 600; color: #DC2626; }
        .d-alert-sub { font-size: 12px; color: var(--text-muted); }

        .d-stats { display: grid; grid-template-columns: repeat(5,1fr); gap: 14px; margin-bottom: 24px; }
        .d-stat-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
        .d-stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 8px; }
        .d-stat-num { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; }
        .d-stat-num.gold { color: var(--gold); }
        .d-stat-num.red { color: #DC2626; }
        .d-stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 5px; }

        .d-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
        .d-tab { padding: 10px 18px; font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; font-family: 'Inter', sans-serif; transition: all 0.12s; }
        .d-tab.active { color: var(--navy); border-bottom-color: var(--navy); }
        .d-tab-badge { display: inline-flex; align-items: center; justify-content: center; background: #DC2626; color: #fff; font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: 4px; }

        .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; }
        .b-active { background: rgba(5,150,105,0.08); color: #059669; }
        .b-review { background: rgba(217,119,6,0.1); color: #D97706; }
        .b-kyc { background: rgba(59,130,246,0.08); color: #2563EB; }
        .b-funded { background: rgba(212,148,10,0.12); color: var(--gold); }
        .b-borrower { background: rgba(212,148,10,0.1); color: var(--gold); }
        .b-lender { background: rgba(59,130,246,0.08); color: #2563EB; }
        .b-pending { background: rgba(27,43,75,0.07); color: var(--navy); }
        .b-approved { background: rgba(5,150,105,0.08); color: #059669; }
      `}</style>

      <div className="d-demo-banner">
        <div className="d-demo-left"><div className="d-demo-dot"></div><span className="d-demo-label">Demo Mode</span></div>
        <div className="d-demo-pills">
          <button className={`d-demo-pill ${persona === 'borrower' ? 'active' : ''}`} onClick={() => setPersona('borrower')}>Borrower</button>
          <button className={`d-demo-pill ${persona === 'lender' ? 'active' : ''}`} onClick={() => setPersona('lender')}>Lender</button>
          <button className={`d-demo-pill ${persona === 'admin' ? 'active' : ''}`} onClick={() => setPersona('admin')}>Admin</button>
        </div>
        <button className="d-demo-exit" onClick={() => setLocation('/')}>Exit Demo</button>
      </div>

      <div className="d-sidebar">
        <div className="d-sb-head">
          <img src={LOGO_NAVY} alt="Junni" className="d-sb-logo" />
          <span className="d-admin-badge">Admin</span>
        </div>
        <div className="d-sb-section">Management</div>
        {currentPersona.navItems.map((item: any, idx: number) => (
          <button key={idx} className={`d-sb-item ${item.active ? 'active' : ''}`}>
            <span>{item.icon}</span>{item.text}
            {item.badge && <span className="d-sb-badge">{item.badge}</span>}
          </button>
        ))}
        <div className="d-sb-section">Platform</div>
        {currentPersona.accountItems.map((item: any, idx: number) => (
          <button key={idx} className="d-sb-item">
            <span>{item.icon}</span>{item.text}
          </button>
        ))}
        <div className="d-sb-bottom">
          <div className="d-sb-user">
            <div className="d-sb-avatar">{currentPersona.userAvatar}</div>
            <div><div className="d-sb-name">{currentPersona.userName}</div><div className="d-sb-role">{currentPersona.userRole}</div></div>
          </div>
        </div>
      </div>

      <div className={`d-topbar ${!topbarVisible ? 'hidden' : ''}`}>
        <div className="d-topbar-title">Admin Panel</div>
        <div className="d-topbar-right">
          <button className="a-btn a-btn-ghost" onClick={() => alert('Export Data')}>Export Data</button>
          <button className="a-btn a-btn-navy" onClick={() => alert('Platform Settings')}>Platform Settings</button>
        </div>
      </div>

      <div className="d-main">
        <div className="d-alert">
          <div><div className="d-alert-text">⚠ 3 deals pending KYC review</div><div className="d-alert-sub">Action required before deals go live</div></div>
          <button className="a-btn a-btn-ghost" onClick={() => setActiveTab(2)}>Review Now</button>
        </div>

        <div className="d-stats">
          <div className="d-stat-card"><div className="d-stat-label">Total Users</div><div className="d-stat-num">1,842</div><div className="d-stat-sub">+24 this week</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Active Deals</div><div className="d-stat-num gold">38</div><div className="d-stat-sub">12 pending review</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Capital Deployed</div><div className="d-stat-num">$450M</div><div className="d-stat-sub">all time</div></div>
          <div className="d-stat-card"><div className="d-stat-label">KYC Pending</div><div className="d-stat-num red">3</div><div className="d-stat-sub">needs review</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Platform Fee</div><div className="d-stat-num">2.5%</div><div className="d-stat-sub">per deal</div></div>
        </div>

        <div className="d-tabs">
          <button className={`d-tab ${activeTab === 0 ? 'active' : ''}`} onClick={() => setActiveTab(0)}>Deals</button>
          <button className={`d-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>Users</button>
          <button className={`d-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>KYC Review <span className="d-tab-badge">3</span></button>
          <button className={`d-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>Bids</button>
        </div>

        {renderTabContent(false)}
      </div>
    </div>
  );
}
