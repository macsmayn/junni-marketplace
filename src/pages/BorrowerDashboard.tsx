import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

const LOGO_NAVY = "/junni-logo-navy.png";

interface DbUser {
  id: string;
  auth0_id: string;
  name: string;
  email: string;
  role: string;
}

interface Deal {
  id: string;
  borrower_id: string;
  company_name: string;
  sector: string;
  province: string;
  amount_requested: number;
  status: string;
  created_at: string;
}

interface Bid {
  id: string;
  deal_id: string;
  lender_id: string;
  interest_rate: number;
  amount_offered: number;
  term_months: number;
  status: string;
  created_at: string;
}

interface DocRecord {
  id: string;
  uploaded_by: string;
  deal_id: string | null;
  file_name: string;
  file_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return "?";
  return name
    .trim()
    .split(" ")
    .filter((n) => n)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getDealStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    under_review: "Under Review",
    pending: "Under Review",
    funded: "Funded",
    closed: "Closed",
  };
  return labels[status] || status;
}

function getDocIcon(fileType: string): string {
  if (!fileType) return "📄";
  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.includes("pdf")) return "📄";
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) return "📊";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  return "📄";
}

function formatLenderId(lenderId: string): string {
  const parts = lenderId.split("-");
  return `Lender #${(parts[parts.length - 1] || lenderId).toUpperCase().slice(0, 6)}`;
}

export default function BorrowerDashboard() {
  const [location, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: auth0Loading } = useAuth0();
  const [persona, setPersona] = useState("borrower");
  const [lang, setLang] = useState("en");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const lastScrollY = useRef(0);

  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (auth0Loading) return;
    if (!isAuthenticated || !user?.sub) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("auth0_id", user.sub)
          .single();

        if (userError || !userData) {
          setLoading(false);
          return;
        }

        setDbUser(userData);

        const { data: dealsData } = await supabase
          .from("deals")
          .select("*")
          .eq("borrower_id", userData.id)
          .order("created_at", { ascending: false });

        const fetchedDeals: Deal[] = dealsData || [];
        setDeals(fetchedDeals);

        if (fetchedDeals.length > 0) {
          const dealIds = fetchedDeals.map((d) => d.id);
          const { data: bidsData } = await supabase
            .from("bids")
            .select("*")
            .in("deal_id", dealIds)
            .order("created_at", { ascending: false });
          setBids(bidsData || []);
        }

        const { data: docsData } = await supabase
          .from("documents")
          .select("*")
          .eq("uploaded_by", userData.id)
          .order("created_at", { ascending: false });

        setDocuments(docsData || []);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, user?.sub, auth0Loading]);

  // Computed stats
  const activeDealCount = deals.length;
  const totalRequested = deals.reduce((sum, d) => sum + (d.amount_requested || 0), 0);
  const pendingBids = bids.filter((b) => b.status === "pending");
  const bestRate = bids.length > 0 ? Math.min(...bids.map((b) => b.interest_rate)) : null;
  const dealsUnderReview = deals.filter(
    (d) => d.status === "under_review" || d.status === "pending"
  ).length;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const newBidsThisWeek = bids.filter((b) => new Date(b.created_at) > oneWeekAgo).length;

  const displayName = user?.name || dbUser?.name || "there";
  const firstName = displayName.split(" ")[0];
  const userInitials = getInitials(displayName);

  const getDealName = (dealId: string): string => {
    const deal = deals.find((d) => d.id === dealId);
    return deal?.company_name || "Unknown Deal";
  };

  const handleNavClick = (item: any, closeSidebar: boolean) => {
    if (item.route) {
      setLocation(item.route);
    } else if (item.scrollTo) {
      document.getElementById(item.scrollTo)?.scrollIntoView({ behavior: "smooth" });
    } else if (item.alertMsg) {
      alert(item.alertMsg);
    }
    if (closeSidebar) setSidebarOpen(false);
  };

  const handleViewDocument = async (doc: DocRecord) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 3600);
    if (error || !data?.signedUrl) {
      alert("Could not generate document URL.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDeleteDocument = async (doc: DocRecord) => {
    try {
      await supabase.storage.from("documents").remove([doc.storage_path]);
      await supabase.from("documents").delete().eq("id", doc.id);
      if (dbUser) {
        const { data: docsData } = await supabase
          .from("documents")
          .select("*")
          .eq("uploaded_by", dbUser.id)
          .order("created_at", { ascending: false });
        setDocuments(docsData || []);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dbUser) return;
    setUploading(true);
    try {
      const path = `${dbUser.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("documents").insert({
        file_name: file.name,
        file_type: file.type,
        size_bytes: file.size,
        storage_path: path,
        uploaded_by: dbUser.id,
        deal_id: deals[0]?.id ?? null,
      });
      if (insertError) throw insertError;
      const { data: docsData } = await supabase
        .from("documents")
        .select("*")
        .eq("uploaded_by", dbUser.id)
        .order("created_at", { ascending: false });
      setDocuments(docsData || []);
    } catch (err) {
      console.error("Error uploading document:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const personas: Record<string, any> = {
    borrower: {
      sidebarLabel: "BORROWER",
      navItems: [
        { icon: "◉", text: "Dashboard", badge: null, route: "/borrower-dashboard" },
        { icon: "📋", text: "My Deals", badge: activeDealCount > 0 ? String(activeDealCount) : null, scrollTo: "deals" },
        { icon: "💼", text: "Bids Received", badge: pendingBids.length > 0 ? String(pendingBids.length) : null, scrollTo: "bids" },
        { icon: "📄", text: "Documents", badge: null, scrollTo: "documents" },
        { icon: "🔔", text: "Notifications", badge: null, alertMsg: "Notifications coming soon" },
      ],
      accountItems: [
        { icon: "🏪", text: "Marketplace", badge: null, route: "/marketplace" },
        { icon: "⚙️", text: "Settings", badge: null, alertMsg: "Settings coming soon" },
      ],
      userName: displayName,
      userAvatar: userInitials,
      userRole: "Borrower",
    },
    lender: {
      sidebarLabel: "LENDER",
      navItems: [
        { icon: "◉", text: "Dashboard", badge: null, route: "/lender-dashboard" },
        { icon: "📊", text: "Portfolio", badge: null, route: "/lender-portfolio" },
        { icon: "🎯", text: "Opportunities", badge: "12", route: "/marketplace" },
        { icon: "📄", text: "Documents", badge: null, alertMsg: "Documents coming soon" },
        { icon: "🔔", text: "Notifications", badge: "3", alertMsg: "Notifications coming soon" },
      ],
      accountItems: [
        { icon: "🏪", text: "Marketplace", badge: null, route: "/marketplace" },
        { icon: "⚙️", text: "Settings", badge: null, alertMsg: "Settings coming soon" },
      ],
      userName: "Sarah Chen",
      userAvatar: "SC",
      userRole: "Lender",
    },
    admin: {
      sidebarLabel: "ADMIN",
      navItems: [
        { icon: "◉", text: "Overview", badge: null, route: "/admin" },
        { icon: "📋", text: "Deals", badge: "12", alertMsg: "Admin deals coming soon" },
        { icon: "👥", text: "Users", badge: null, alertMsg: "Admin users coming soon" },
        { icon: "🔍", text: "KYC Review", badge: "3", alertMsg: "KYC review coming soon" },
        { icon: "💼", text: "Bids", badge: null, alertMsg: "Admin bids coming soon" },
      ],
      accountItems: [
        { icon: "📊", text: "Analytics", badge: null, alertMsg: "Analytics coming soon" },
        { icon: "⚙️", text: "Settings", badge: null, alertMsg: "Settings coming soon" },
      ],
      userName: "Admin",
      userAvatar: "A",
      userRole: "Full Access",
    },
  };

  const currentPersona = personas[persona] || personas.borrower;

  if (auth0Loading || loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#FAF8F4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', sans-serif",
          color: "#1B2B4B",
          fontSize: "15px",
          fontWeight: 500,
          letterSpacing: "-0.01em",
        }}
      >
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

          .section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 11px; }
          .section-title { font-size: 15px; font-weight: 700; color: var(--navy); }
          .section-link { background: none; border: none; color: var(--gold); font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }

          .deal-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; }
          .deal-card:last-child { margin-bottom: 0; }
          .deal-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
          .deal-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 3px; line-height: 1.3; }
          .deal-sub { font-size: 11px; color: var(--text-muted); line-height: 1.4; }
          .deal-amount { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px; white-space: nowrap; }
          .deal-bottom { display: flex; justify-content: space-between; align-items: center; }
          .status { font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 100px; }
          .status-active { background: rgba(5,150,105,0.08); color: var(--green); }
          .status-review { background: rgba(217,119,6,0.1); color: var(--amber); }
          .deal-view { background: none; border: 1px solid var(--border); color: var(--navy); font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; }

          .bid-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 15px; margin-bottom: 10px; }
          .bid-card:last-child { margin-bottom: 0; }
          .bid-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .bid-lender { font-size: 13px; font-weight: 600; color: var(--navy); }
          .bid-deal { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
          .bid-rate { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: var(--navy); }
          .bid-rate.best { color: var(--green); }
          .bid-meta { display: flex; gap: 16px; margin-bottom: 12px; }
          .bid-meta-item { display: flex; flex-direction: column; gap: 2px; }
          .bid-meta-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
          .bid-meta-val { font-size: 13px; font-weight: 600; color: var(--navy); }
          .bid-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border); }
          .bid-action { font-size: 12px; font-weight: 600; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; border: none; }
          .bid-action.accept { background: var(--gold); color: #fff; }
          .bid-action.counter { background: none; border: 1px solid var(--border); color: var(--navy); }

          .doc-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px; }
          .doc-card:last-child { margin-bottom: 0; }
          .doc-icon { width: 40px; height: 40px; background: rgba(212,148,10,0.1); border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
          .doc-info { flex: 1; min-width: 0; }
          .doc-name { font-size: 13px; font-weight: 600; color: var(--navy); margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .doc-meta { font-size: 11px; color: var(--text-muted); }
          .doc-view { background: none; border: 1px solid var(--border); color: var(--navy); font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 7px; cursor: pointer; font-family: 'Inter', sans-serif; flex-shrink: 0; }

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
            <span className="nav-title">Dashboard</span>
          </div>
          <div className="nav-right">
            <button className="bell" aria-label="Notifications">🔔<span className="bell-dot"></span></button>
            <button className="btn btn-gold nav-new" onClick={() => setLocation('/onboarding')}>+ New Deal</button>
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
            <a key={idx} className={`sb-item ${item.route === location ? 'active' : ''}`} href="#" onClick={(e) => { e.preventDefault(); handleNavClick(item, true); }}>
              <span>{item.icon}</span>{item.text}
              {item.badge && <span className="sb-badge">{item.badge}</span>}
            </a>
          ))}
          <div className="sb-section">ACCOUNT</div>
          {currentPersona.accountItems.map((item: any, idx: number) => (
            <a key={idx} className={`sb-item ${item.route === location ? 'active' : ''}`} href="#" onClick={(e) => { e.preventDefault(); handleNavClick(item, true); }}>
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
            <h2>Welcome back, {firstName}.</h2>
            <p>
              {activeDealCount > 0 || bids.length > 0
                ? `You have ${activeDealCount} active deal${activeDealCount !== 1 ? "s" : ""} and ${pendingBids.length} new bid${pendingBids.length !== 1 ? "s" : ""} to review.`
                : "Get started by submitting your first deal."}
            </p>
            <div className="welcome-actions">
              <button className="btn btn-gold" onClick={() => setLocation('/onboarding')}>+ Submit New Deal</button>
              <button className="btn btn-ghost-white">View Deals</button>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Active Deals</div>
              <div className="stat-num">{activeDealCount}</div>
              <div className="stat-sub">{dealsUnderReview > 0 ? `${dealsUnderReview} pending review` : "None pending review"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Requested</div>
              <div className="stat-num">{totalRequested > 0 ? formatCurrency(totalRequested) : "—"}</div>
              <div className="stat-sub">across {activeDealCount} deal{activeDealCount !== 1 ? "s" : ""}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Bids Received</div>
              <div className="stat-num gold">{bids.length}</div>
              <div className="stat-sub">{newBidsThisWeek > 0 ? `${newBidsThisWeek} new this week` : "None this week"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Best Rate Offered</div>
              <div className="stat-num">{bestRate !== null ? `${bestRate.toFixed(1)}%` : "—"}</div>
              <div className="stat-sub">{bids.length > 0 ? `across ${bids.length} bid${bids.length !== 1 ? "s" : ""}` : "No bids yet"}</div>
            </div>
          </div>

          <div id="deals">
            <div className="section-head">
              <div className="section-title">My Deals</div>
              <button className="section-link" onClick={() => setLocation('/marketplace')}>View All</button>
            </div>
            {deals.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", padding: "24px", textAlign: "center", color: "#7A7060", fontSize: "13px" }}>
                No deals yet.{" "}
                <button style={{ background: "none", border: "none", color: "#D4940A", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px" }} onClick={() => setLocation('/onboarding')}>
                  Submit your first deal
                </button>{" "}
                to get started.
              </div>
            ) : (
              deals.map((deal) => (
                <div key={deal.id} className="deal-card">
                  <div className="deal-top">
                    <div>
                      <div className="deal-company">{deal.company_name}</div>
                      <div className="deal-sub">{deal.sector} · {deal.province} · Submitted {formatDate(deal.created_at)}</div>
                    </div>
                    <div className="deal-amount">{formatCurrency(deal.amount_requested)}</div>
                  </div>
                  <div className="deal-bottom">
                    <span className={`status ${deal.status === "active" ? "status-active" : "status-review"}`}>
                      {getDealStatusLabel(deal.status)}
                    </span>
                    <button className="deal-view" onClick={() => setLocation(`/deals/${deal.id}`)}>View →</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div id="bids">
            <div className="section-head">
              <div className="section-title">Recent Bids</div>
              <button className="section-link" onClick={() => setLocation('/marketplace')}>View All</button>
            </div>
            {bids.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", padding: "24px", textAlign: "center", color: "#7A7060", fontSize: "13px" }}>
                No bids received yet.
              </div>
            ) : (
              bids.slice(0, 5).map((bid) => {
                const isBest = bid.interest_rate === bestRate;
                return (
                  <div key={bid.id} className="bid-card">
                    <div className="bid-top">
                      <div>
                        <div className="bid-lender">{formatLenderId(bid.lender_id)}</div>
                        <div className="bid-deal">{getDealName(bid.deal_id)}</div>
                      </div>
                      <div className={`bid-rate${isBest ? " best" : ""}`}>{bid.interest_rate.toFixed(1)}%</div>
                    </div>
                    <div className="bid-meta">
                      <div className="bid-meta-item">
                        <span className="bid-meta-label">Amount</span>
                        <span className="bid-meta-val">{formatCurrency(bid.amount_offered)}</span>
                      </div>
                      <div className="bid-meta-item">
                        <span className="bid-meta-label">Term</span>
                        <span className="bid-meta-val">{bid.term_months} mo</span>
                      </div>
                      <div className="bid-meta-item">
                        <span className="bid-meta-label">Status</span>
                        <span className="status status-review" style={{ padding: "2px 8px" }}>
                          {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="bid-bottom">
                      <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{isBest ? "Best rate offered" : ""}</span>
                      {bid.status === "pending" ? (
                        <button className="bid-action accept" onClick={() => alert("Bid accepted. Lender will be notified.")}>Accept</button>
                      ) : (
                        <button className="bid-action counter" onClick={() => alert("Counter offer flow coming soon.")}>Counter</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div id="documents">
            <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
            <div className="section-head">
              <div className="section-title">Uploaded Documents</div>
              <button className="section-link" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? "Uploading..." : "Upload New"}</button>
            </div>
            {documents.length === 0 ? (
              <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", padding: "24px", textAlign: "center", color: "#7A7060", fontSize: "13px" }}>
                No documents uploaded yet.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="doc-card">
                  <div className="doc-icon">{getDocIcon(doc.file_type)}</div>
                  <div className="doc-info">
                    <div className="doc-name">{doc.file_name}</div>
                    <div className="doc-meta">{doc.file_type} · {formatDate(doc.created_at)}</div>
                  </div>
                  <button className="doc-view" onClick={() => handleViewDocument(doc)}>View</button>
                  <button className="doc-view" style={{ marginLeft: "6px", color: "#dc2626", borderColor: "#dc2626" }} onClick={() => handleDeleteDocument(doc)}>Delete</button>
                </div>
              ))
            )}
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
        .d-btn-ghost { background: none; border: 1px solid var(--border); color: var(--navy); padding: 10px 16px; font-size: 13px; }
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

        .d-section { margin-bottom: 24px; }
        .d-section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .d-section-title { font-size: 15px; font-weight: 700; color: var(--navy); }
        .d-section-link { background: none; border: none; color: var(--gold); font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; }

        .d-deal-list { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .d-deal-row { display: grid; grid-template-columns: 1fr auto auto auto; gap: 16px; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border); }
        .d-deal-row:last-child { border-bottom: none; }
        .d-deal-row:hover { background: rgba(27,43,75,0.02); }
        .d-deal-company { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 3px; }
        .d-deal-sub { font-size: 12px; color: var(--text-muted); }
        .d-deal-amount { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 800; color: var(--navy); letter-spacing: -0.5px; }
        .d-status { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 100px; }
        .d-status-active { background: rgba(5,150,105,0.08); color: var(--green); }
        .d-status-review { background: rgba(217,119,6,0.1); color: var(--amber); }
        .d-deal-view { background: none; border: 1px solid var(--border); color: var(--navy); font-size: 12px; font-weight: 600; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; }

        .d-bids-table { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .d-bids-table table { width: 100%; border-collapse: collapse; }
        .d-bids-table th { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); padding: 12px 20px; text-align: left; border-bottom: 1px solid var(--border); }
        .d-bids-table td { font-size: 13px; padding: 14px 20px; border-bottom: 1px solid var(--border); color: var(--navy); }
        .d-bids-table tr:last-child td { border-bottom: none; }
        .d-bids-table tr:hover td { background: rgba(27,43,75,0.015); }
        .d-rate-best { font-weight: 700; color: var(--green); }

        .d-doc-list { background: #fff; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
        .d-doc-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--border); gap: 14px; }
        .d-doc-row:last-child { border-bottom: none; }
        .d-doc-left { display: flex; align-items: center; gap: 12px; }
        .d-doc-icon { width: 38px; height: 38px; background: rgba(212,148,10,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
        .d-doc-name { font-size: 13px; font-weight: 600; color: var(--navy); margin-bottom: 2px; }
        .d-doc-type { font-size: 11px; color: var(--text-muted); }
        .d-doc-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .d-doc-date { font-size: 12px; color: var(--text-muted); }
        .d-doc-view { background: none; border: 1px solid var(--border); color: var(--navy); font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 7px; cursor: pointer; font-family: 'Inter', sans-serif; }
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
          <button key={idx} className={`d-sb-item ${item.route === location ? 'active' : ''}`} onClick={() => handleNavClick(item, false)}>
            <span>{item.icon}</span>{item.text}
            {item.badge && <span className="d-sb-badge">{item.badge}</span>}
          </button>
        ))}
        <div className="d-sb-section">ACCOUNT</div>
        {currentPersona.accountItems.map((item: any, idx: number) => (
          <button key={idx} className={`d-sb-item ${item.route === location ? 'active' : ''}`} onClick={() => handleNavClick(item, false)}>
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
        <div className="d-topbar-title">Dashboard</div>
        <div className="d-topbar-right">
          <div className="d-lang-pill">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'fr' ? 'active' : ''} onClick={() => setLang('fr')}>FR</button>
          </div>
          <button className="d-bell" aria-label="Notifications">🔔<span className="d-bell-dot"></span></button>
          <button className="d-btn d-btn-gold" onClick={() => setLocation('/onboarding')}>+ New Deal</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="d-main">

        {/* WELCOME */}
        <div className="d-welcome">
          <div>
            <h2>Welcome back, {firstName}.</h2>
            <p>
              {activeDealCount > 0 || bids.length > 0
                ? `You have ${activeDealCount} active deal${activeDealCount !== 1 ? "s" : ""} and ${pendingBids.length} new bid${pendingBids.length !== 1 ? "s" : ""} to review.`
                : "Get started by submitting your first deal."}
            </p>
          </div>
          <div className="d-welcome-actions">
            <button className="d-btn d-btn-ghost-white">View Deals</button>
            <button className="d-btn d-btn-gold" onClick={() => setLocation('/onboarding')}>+ Submit New Deal</button>
          </div>
        </div>

        {/* STATS */}
        <div className="d-stats">
          <div className="d-stat-card">
            <div className="d-stat-label">Active Deals</div>
            <div className="d-stat-num">{activeDealCount}</div>
            <div className="d-stat-sub">{dealsUnderReview > 0 ? `${dealsUnderReview} pending review` : "None pending review"}</div>
          </div>
          <div className="d-stat-card">
            <div className="d-stat-label">Total Requested</div>
            <div className="d-stat-num">{totalRequested > 0 ? formatCurrency(totalRequested) : "—"}</div>
            <div className="d-stat-sub">across {activeDealCount} deal{activeDealCount !== 1 ? "s" : ""}</div>
          </div>
          <div className="d-stat-card">
            <div className="d-stat-label">Bids Received</div>
            <div className="d-stat-num gold">{bids.length}</div>
            <div className="d-stat-sub">{newBidsThisWeek > 0 ? `${newBidsThisWeek} new this week` : "None this week"}</div>
          </div>
          <div className="d-stat-card">
            <div className="d-stat-label">Best Rate Offered</div>
            <div className="d-stat-num">{bestRate !== null ? `${bestRate.toFixed(1)}%` : "—"}</div>
            <div className="d-stat-sub">{bids.length > 0 ? `across ${bids.length} bid${bids.length !== 1 ? "s" : ""}` : "No bids yet"}</div>
          </div>
        </div>

        {/* MY DEALS */}
        <div id="deals" className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">My Deals</div>
            <button className="d-section-link" onClick={() => setLocation('/marketplace')}>View All</button>
          </div>
          <div className="d-deal-list">
            {deals.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#7A7060", fontSize: "13px" }}>
                No deals yet.{" "}
                <button style={{ background: "none", border: "none", color: "#D4940A", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", fontSize: "13px" }} onClick={() => setLocation('/onboarding')}>
                  Submit your first deal
                </button>{" "}
                to get started.
              </div>
            ) : (
              deals.map((deal) => (
                <div key={deal.id} className="d-deal-row">
                  <div>
                    <div className="d-deal-company">{deal.company_name}</div>
                    <div className="d-deal-sub">{deal.sector} · {deal.province} · Submitted {formatDate(deal.created_at)}</div>
                  </div>
                  <div className="d-deal-amount">{formatCurrency(deal.amount_requested)}</div>
                  <span className={`d-status ${deal.status === "active" ? "d-status-active" : "d-status-review"}`}>
                    {getDealStatusLabel(deal.status)}
                  </span>
                  <button className="d-deal-view" onClick={() => setLocation(`/deals/${deal.id}`)}>View →</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT BIDS */}
        <div id="bids" className="d-section">
          <div className="d-section-head">
            <div className="d-section-title">Recent Bids</div>
            <button className="d-section-link" onClick={() => setLocation('/marketplace')}>View All</button>
          </div>
          <div className="d-bids-table">
            <table>
              <thead>
                <tr>
                  <th>Lender</th><th>Deal</th><th>Rate Offered</th><th>Amount</th><th>Term</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {bids.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#7A7060", padding: "32px" }}>
                      No bids received yet.
                    </td>
                  </tr>
                ) : (
                  bids.slice(0, 10).map((bid) => {
                    const isBest = bid.interest_rate === bestRate;
                    return (
                      <tr key={bid.id}>
                        <td style={{ fontWeight: 600 }}>{formatLenderId(bid.lender_id)}</td>
                        <td style={{ color: "var(--text-muted)" }}>{getDealName(bid.deal_id)}</td>
                        <td className={isBest ? "d-rate-best" : ""} style={{ fontWeight: 700 }}>{bid.interest_rate.toFixed(1)}%</td>
                        <td>{formatCurrency(bid.amount_offered)}</td>
                        <td>{bid.term_months} mo</td>
                        <td><span className="d-status d-status-review">{bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}</span></td>
                        <td>
                          {bid.status === "pending" ? (
                            <button className="d-btn d-btn-gold" style={{ fontSize: "11px", padding: "6px 12px" }} onClick={() => alert("Bid accepted. Lender will be notified.")}>Accept</button>
                          ) : (
                            <button className="d-btn d-btn-ghost" style={{ fontSize: "11px", padding: "6px 12px" }} onClick={() => alert("Counter offer flow coming soon.")}>Counter</button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DOCUMENTS */}
        <div id="documents" className="d-section">
          <input type="file" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileUpload} />
          <div className="d-section-head">
            <div className="d-section-title">Uploaded Documents</div>
            <button className="d-section-link" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? "Uploading..." : "Upload New Document"}</button>
          </div>
          <div className="d-doc-list">
            {documents.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#7A7060", fontSize: "13px" }}>
                No documents uploaded yet.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="d-doc-row">
                  <div className="d-doc-left">
                    <div className="d-doc-icon">{getDocIcon(doc.file_type)}</div>
                    <div>
                      <div className="d-doc-name">{doc.file_name}</div>
                      <div className="d-doc-type">{doc.file_type}</div>
                    </div>
                  </div>
                  <div className="d-doc-right">
                    <span className="d-doc-date">{formatDate(doc.created_at)}</span>
                    <button className="d-doc-view" onClick={() => handleViewDocument(doc)}>View</button>
                    <button className="d-doc-view" style={{ color: "#dc2626", borderColor: "#dc2626" }} onClick={() => handleDeleteDocument(doc)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
