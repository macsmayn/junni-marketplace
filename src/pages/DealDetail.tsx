import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";
import { useParams } from "wouter";

const LOGO_BEIGE = "/junni-logo-beige.png";

const DEAL = {
  id: 1,
  company: "Maple Ridge Manufacturing",
  risk: "Very Low Risk",
  industry: "Manufacturing",
  location: "Ontario",
  yearsInBusiness: "15 years in business",
  description:
    "Established manufacturer of precision injection-molded components for automotive and consumer goods. Seeking $3.2M expansion financing to add two new production lines and enter European markets.",
  funded: 78,
  fundedAmount: "$2.5M",
  remaining: "$700K",
  loanAmount: "$3.2M",
  term: "5 years",
  targetRate: "6.5% – 8.0%",
  annualRevenue: "$28.5M",
  ebitda: "$4.2M",
  yearsOperating: 15,
  debtToEquity: 0.65,
  dscr: 2.8,
  currentRatio: 1.9,
  activeBids: 12,
  bestRate: "6.9%",
  closesIn: "5 days",
  remainingAmount: "$704K",
};


const BIDS = [
  {
    id: 1,
    lender: "Cascade Capital",
    type: "PE Fund",
    rate: "6.9%",
    amount: "$500K",
    status: "Accepted",
  },
  {
    id: 2,
    lender: "Prairie Credit Union",
    type: "Credit Union",
    rate: "7.1%",
    amount: "$750K",
    status: "Pending",
  },
  {
    id: 3,
    lender: "Venture Lending",
    type: "Fintech",
    rate: "7.4%",
    amount: "$600K",
    status: "Pending",
  },
  {
    id: 4,
    lender: "Maple Institutional",
    type: "Family Office",
    rate: "7.2%",
    amount: "$350K",
    status: "Pending",
  },
];

const DOCUMENTS = [
  { icon: "📄", name: "Financial Statements", type: "PDF • 2.4 MB" },
  { icon: "📊", name: "Business Plan", type: "PDF • 1.8 MB" },
  { icon: "📋", name: "Management Summary", type: "PDF • 890 KB" },
];

const ADDITIONAL_BIDS = [
  {
    id: 5,
    lender: "Northstar Capital",
    type: "Investment Bank",
    rate: "6.8%",
    amount: "$400K",
    status: "Pending",
  },
  {
    id: 6,
    lender: "Regional Finance",
    type: "Bank",
    rate: "7.3%",
    amount: "$550K",
    status: "Pending",
  },
  {
    id: 7,
    lender: "Growth Partners",
    type: "PE Fund",
    rate: "7.0%",
    amount: "$480K",
    status: "Pending",
  },
  {
    id: 8,
    lender: "Equity Ventures",
    type: "Fintech",
    rate: "7.5%",
    amount: "$320K",
    status: "Pending",
  },
  {
    id: 9,
    lender: "Institutional Lending",
    type: "Lender",
    rate: "6.95%",
    amount: "$420K",
    status: "Pending",
  },
  {
    id: 10,
    lender: "Capital Solutions",
    type: "Fintech",
    rate: "7.2%",
    amount: "$380K",
    status: "Pending",
  },
  {
    id: 11,
    lender: "Strategic Finance",
    type: "Investment Fund",
    rate: "7.1%",
    amount: "$450K",
    status: "Pending",
  },
  {
    id: 12,
    lender: "Premier Lenders",
    type: "Bank",
    rate: "7.4%",
    amount: "$500K",
    status: "Pending",
  },
];

export default function DealDetail() {
  const params = useParams<{ id: string }>();
  const dealId = params.id;

  const { user, isAuthenticated } = useAuth0();
  const [deal, setDeal] = useState<any>(null);
  const [dealBids, setDealBids] = useState<any[]>([]);
  const [dealDocs, setDealDocs] = useState<any[]>([]);
  const [dbUser, setDbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [bidRate, setBidRate] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidTerm, setBidTerm] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);
  const [creditScore, setCreditScore] = useState<any>(null);
  const [computedMetrics, setComputedMetrics] = useState<any[]>([]);
  const [answeredQuestions, setAnsweredQuestions] = useState<any[]>([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [expandedBids, setExpandedBids] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [dealRes, bidsRes, docsRes, scoreRes, metricsRes, qaRes] = await Promise.all([
        supabase.from('deals').select('*').eq('id', dealId).single(),
        supabase.from('bids').select('*').eq('deal_id', dealId),
        supabase.from('documents').select('*').eq('deal_id', dealId),
        supabase.from('credit_scores').select('*').eq('deal_id', dealId).single(),
        supabase.from('computed_metrics')
          .select('metric_key, metric_label, value, unit, benchmark_status, industry_tier, fiscal_year')
          .eq('deal_id', dealId)
          .order('fiscal_year', { ascending: false, nullsFirst: false }),
        supabase.from('credit_questions')
          .select('id, question_text, answer, answer_assessment, related_metric, source')
          .eq('deal_id', dealId)
          .eq('status', 'approved')
          .not('answer', 'is', null)
          .not('answer_assessment', 'is', null),
      ]);
      if (dealRes.data) setDeal(dealRes.data);
      if (metricsRes.data) setComputedMetrics(metricsRes.data);
      if (bidsRes.data) {
        const bids = bidsRes.data;
        const lenderIds = [...new Set(bids.map((b: any) => b.lender_id))];
        if (lenderIds.length > 0) {
          const { data: profiles } = await supabase
            .from('lender_profiles')
            .select('user_id, lender_number')
            .in('user_id', lenderIds);
          const profileMap: Record<string, number | null> = {};
          (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.lender_number; });
          setDealBids(bids.map((b: any) => ({ ...b, lender_number: profileMap[b.lender_id] ?? null })));
        } else {
          setDealBids(bids);
        }
      }
      if (docsRes.data) setDealDocs(docsRes.data);
      setCreditScore(scoreRes.data || null);
      if (qaRes.data) setAnsweredQuestions(qaRes.data);
      if (isAuthenticated && user?.sub) {
        const { data: userData } = await supabase.from('users').select('*').eq('auth0_id', user.sub).single();
        if (userData) setDbUser(userData);
      }
      setLoading(false);
    };
    fetchData();
  }, [dealId, isAuthenticated, user?.sub]);

  const handleBidSubmit = async () => {
    if (!dbUser) { alert("Please log in to place a bid."); return; }
    if (!bidRate || !bidAmount) { alert("Please enter both a rate and an amount."); return; }
    setSubmittingBid(true);
    const { error } = await supabase.from('bids').insert({
      deal_id: dealId,
      lender_id: dbUser.id,
      amount: parseFloat(bidAmount),
      interest_rate: parseFloat(bidRate),
      term_months: parseInt(bidTerm) || deal?.term_months || 36,
      status: 'pending',
    });
    if (error) {
      console.error('Bid error:', error);
      alert("Error placing bid. Please try again.");
    } else {
      const { error: notifErr } = await supabase.rpc('notify_bid_received', { p_deal_id: deal.id });
      if (notifErr) console.error('Notification failed (bid):', notifErr);
      alert("Bid placed successfully!");
      setBidRate("");
      setBidAmount("");
      setBidTerm("");
      const { data } = await supabase.from('bids').select('*').eq('deal_id', dealId);
      const bids = data || [];
      const lenderIds = [...new Set(bids.map((b: any) => b.lender_id))];
      if (lenderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('lender_profiles')
          .select('user_id, lender_number')
          .in('user_id', lenderIds);
        const profileMap: Record<string, number | null> = {};
        (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.lender_number; });
        setDealBids(bids.map((b: any) => ({ ...b, lender_number: profileMap[b.lender_id] ?? null })));
      } else {
        setDealBids(bids);
      }
    }
    setSubmittingBid(false);
  };

  const handleViewDocument = () => {
    setShowDocModal(true);
  };

  const handleExpandBids = () => {
    setExpandedBids(true);
  };

  const formatCurrency = (n: number): string => {
    if (n == null || isNaN(n)) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n.toLocaleString()}`;
  };

  const formatLenderId = (id: string, lenderNumber?: number | null): string => {
    if (lenderNumber != null) return `Lender #${lenderNumber}`;
    const hash = id.replace(/-/g, "");
    const letter = String.fromCharCode(65 + (parseInt(hash.slice(0, 4), 16) % 26));
    const num = parseInt(hash.slice(4, 8), 16) % 100;
    return `Lender ${letter}${String(num).padStart(2, "0")}`;
  };

  const toParas = (text: string): string[] => {
    if (!text) return [];
    // Split only on sentence boundaries: period/!/? followed by space, not inside numbers
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const chunks: string[] = [];
    for (let i = 0; i < sentences.length; i += 2) {
      chunks.push(sentences.slice(i, i + 2).join(" ").trim());
    }
    return chunks.filter(Boolean);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F4", fontFamily: "Inter, sans-serif", color: "#1B2B4B", fontSize: "16px", fontWeight: 600 }}>
        Loading deal...
      </div>
    );
  }

  return (
    <div className="deal-detail">
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

        .deal-detail {
          font-family: 'Inter', sans-serif;
          font-weight: 400;
          color: var(--text-secondary);
          background-color: var(--cream);
          min-height: 100vh;
        }

        nav {
          position: sticky;
          top: 0;
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

        nav .nav-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        nav .logo {
          display: flex;
          align-items: center;
        }

        nav .logo img {
          height: 72px;
          width: auto;
        }

        nav .nav-back {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          text-decoration: none;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s ease;
        }

        nav .nav-back:hover {
          color: var(--navy);
        }

        nav .nav-right {
          display: flex;
          gap: 12px;
        }

        .btn-nav {
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: all 0.2s ease;
        }

        .btn-ghost {
          background: transparent;
          color: var(--navy);
          border: 1px solid var(--navy);
        }

        .btn-ghost:hover {
          background: var(--navy);
          color: var(--white);
        }

        .btn-gold {
          background: var(--gold);
          color: var(--white);
        }

        .btn-gold:hover {
          opacity: 0.88;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px;
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 32px;
        }

        .hero-section {
          display: flex;
          flex-direction: column;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(5, 150, 105, 0.08);
          color: var(--success);
          font-size: 11px;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 100px;
          width: fit-content;
          margin-bottom: 16px;
        }

        .hero-title {
          font-family: 'Fraunces', serif;
          font-size: 44px;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 12px;
          line-height: 1.1;
        }

        .hero-meta {
          display: flex;
          gap: 24px;
          margin-bottom: 24px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .hero-meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hero-desc {
          font-size: 15px;
          line-height: 1.65;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }

        .deal-status {
          background: linear-gradient(135deg, var(--navy) 0%, #3D5A8A 100%);
          border-radius: 12px;
          padding: 20px;
          color: var(--white);
          margin-bottom: 32px;
        }

        .deal-status-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.7;
          margin-bottom: 8px;
        }

        .deal-status-amount {
          font-family: 'Fraunces', serif;
          font-size: 32px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .progress-bar {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          height: 6px;
          margin-bottom: 12px;
          overflow: hidden;
        }

        .progress-fill {
          background: var(--gold);
          height: 100%;
        }

        .deal-status-footer {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .tabs {
          display: flex;
          gap: 32px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 32px;
        }

        .tab {
          padding: 12px 0;
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .tab.active {
          color: var(--navy);
          border-bottom-color: var(--navy);
        }

        .tab:hover {
          color: var(--navy);
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        .overview-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-bottom: 48px;
        }

        .card {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
        }

        .card-title {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 20px;
        }

        .card-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .card-item {
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }

        .card-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .card-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .card-value {
          font-family: 'Fraunces', serif;
          font-size: 26px;
          font-weight: 800;
          color: var(--navy);
        }

        .card-value-small {
          font-size: 14px;
          font-weight: 600;
          color: var(--navy);
        }

        .card-total {
          background: rgba(212, 148, 10, 0.08);
          border: 2px solid rgba(212, 148, 10, 0.2);
          border-radius: 12px;
          padding: 20px;
          margin-top: 16px;
        }

        .card-total-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--gold);
          margin-bottom: 8px;
        }

        .card-total-value {
          font-family: 'Fraunces', serif;
          font-size: 28px;
          font-weight: 800;
          color: var(--gold);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .metric-item {
          padding: 16px;
          background: rgba(5, 150, 105, 0.06);
          border-radius: 10px;
        }

        .metric-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 8px;
        }

        .metric-value {
          font-family: 'Fraunces', serif;
          font-size: 22px;
          font-weight: 800;
          color: var(--navy);
        }

        .metric-value-small {
          font-size: 10px;
        }

        .metric-score {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 6px;
        }

        .metric-score-secondary {
          font-size: 9px;
          font-weight: 600;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .metrics-divider {
          margin: 32px 0 24px 0;
          padding-top: 24px;
          border-top: 1px solid var(--border);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metrics-secondary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .metric-item-secondary {
          padding: 12px;
          background: rgba(27, 43, 75, 0.02);
          border-radius: 8px;
        }

        .metric-label-secondary {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        .metric-value-secondary {
          font-family: 'Fraunces', serif;
          font-size: 16px;
          font-weight: 700;
          color: var(--navy);
        }

        .ratio-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }
        .ratio-row:last-child { border-bottom: none; }
        .ratio-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
        .ratio-right { display: flex; align-items: center; gap: 8px; }
        .ratio-subhead {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin: 16px 0 8px;
        }
        .badge-strong {
          background: rgba(5,150,105,0.1);
          color: var(--success);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .badge-adequate {
          background: rgba(212,148,10,0.1);
          color: var(--gold);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .badge-weak {
          background: rgba(220,38,38,0.08);
          color: var(--danger);
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 100px;
          white-space: nowrap;
        }

        .bid-item {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .bid-lender {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .bid-lender-name {
          font-weight: 600;
          color: var(--navy);
        }

        .bid-lender-type {
          font-size: 12px;
          color: var(--text-muted);
        }

        .bid-right {
          text-align: right;
        }

        .bid-rate {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 800;
          color: var(--navy);
        }

        .bid-details {
          display: flex;
          gap: 24px;
          font-size: 12px;
          margin-top: 8px;
        }

        .bid-amount {
          color: var(--text-muted);
        }

        .bid-status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .bid-status.accepted {
          background: rgba(5, 150, 105, 0.1);
          color: var(--success);
        }

        .bid-status.pending {
          background: rgba(217, 119, 6, 0.1);
          color: var(--warning);
        }

        .bid-status.rejected {
          background: rgba(220, 38, 38, 0.1);
          color: #DC2626;
        }

        .bid-status.countered {
          background: rgba(212, 148, 10, 0.12);
          color: var(--gold);
        }

        .bids-more {
          text-align: center;
          padding: 16px;
          color: var(--navy);
          font-weight: 600;
          font-size: 13px;
        }

        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .sidebar-card {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
        }

        .sidebar-card-title {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 12px;
        }

        .bid-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-label {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .form-input {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 500;
          color: var(--navy);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 12px;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .form-input:focus {
          border-color: var(--navy);
        }

        .form-hint {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          color: var(--text-muted);
          text-align: center;
          margin-top: 6px;
        }

        .btn-submit {
          width: 100%;
          background: var(--gold);
          color: var(--white);
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-submit:hover {
          opacity: 0.88;
        }

        .sidebar-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-family: 'Inter', sans-serif;
          font-size: 12px;
        }

        .sidebar-stat:last-child {
          border-bottom: none;
        }

        .sidebar-stat-label {
          color: var(--text-muted);
        }

        .sidebar-stat-val {
          font-weight: 700;
          color: var(--navy);
        }

        .doc-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }

        .doc-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .doc-icon-and-text {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .doc-icon {
          font-size: 16px;
        }

        .doc-name {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: var(--navy);
        }

        .doc-type {
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .btn-view {
          background: none;
          border: 1px solid var(--border);
          color: var(--navy);
          border-radius: 5px;
          padding: 3px 8px;
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-view:hover {
          background: rgba(27, 43, 75, 0.03);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: var(--white);
          border-radius: 12px;
          padding: 32px;
          max-width: 400px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-title {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 800;
          color: var(--navy);
          margin-bottom: 12px;
        }

        .modal-text {
          font-size: 14px;
          color: var(--text-secondary);
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .modal-btn {
          background: var(--navy);
          color: var(--white);
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-btn:hover {
          opacity: 0.88;
        }

        @media (max-width: 768px) {
          nav {
            padding: 0 20px;
            height: auto;
            flex-wrap: wrap;
            align-content: flex-start;
          }

          nav .nav-left {
            width: 100%;
            gap: 12px;
            padding: 12px 0;
          }

          nav .logo img {
            height: 30px;
          }

          nav .nav-right {
            width: 100%;
            gap: 8px;
            padding: 8px 0;
          }

          .btn-nav {
            flex: 1;
            padding: 8px 12px;
            font-size: 12px;
          }

          .container {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .overview-grid {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 32px;
          }

          .hero-meta {
            flex-direction: column;
            gap: 8px;
          }

          .metrics-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .metrics-secondary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          @media (max-width: 640px) {
            .metrics-secondary-grid {
              grid-template-columns: 1fr;
            }
          }
        }
      `}</style>

      {/* Navigation */}
      <nav>
        <div className="nav-left">
          <a href="/" className="logo">
            <img src={LOGO_BEIGE} alt="Junni" style={{ width: "120px", height: "auto" }} />
          </a>
          <a href="/marketplace" className="nav-back">
            ← Back to Marketplace
          </a>
        </div>
        <div className="nav-right">
          <button className="btn-nav btn-ghost">Share Deal</button>
          <button className="btn-nav btn-gold">Save Deal</button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="container">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-badge">✓ {creditScore?.risk_label || DEAL.risk}{creditScore?.overall_score != null ? ` · ${creditScore.overall_score}/100` : ""}</div>
          <h1 className="hero-title">{deal?.title || DEAL.company}</h1>
          <div className="hero-meta">
            <div className="hero-meta-item">🏭 {deal?.industry || DEAL.industry}</div>
            <div className="hero-meta-item">📍 {deal?.city && deal?.province ? `${deal.city}, ${deal.province}` : DEAL.location}</div>
            <div className="hero-meta-item">{deal?.years_in_business ? `${deal.years_in_business} years in business` : DEAL.yearsInBusiness}</div>
          </div>
          <div className="hero-desc">
            {toParas(deal?.ai_summary || DEAL.description).map((chunk, i, arr) => (
              <p key={i} style={{ marginBottom: i < arr.length - 1 ? "12px" : "0" }}>{chunk}</p>
            ))}
          </div>

          {/* Deal Status Badge */}
          {deal?.status && (() => {
            const STATUS_LABEL: Record<string, string> = { active: "Active", pending: "Pending", funded: "Funded", closed: "Closed", rejected: "Rejected" };
            const STATUS_STYLE: Record<string, { background: string; color: string }> = {
              active:   { background: "rgba(5,150,105,0.12)", color: "#059669" },
              pending:  { background: "rgba(217,119,6,0.1)",  color: "#D97706" },
              funded:   { background: "#059669",              color: "#fff"    },
              closed:   { background: "#4B5563",              color: "#fff"    },
              rejected: { background: "rgba(220,38,38,0.1)",  color: "#DC2626" },
            };
            const s = STATUS_STYLE[deal.status] || { background: "rgba(27,43,75,0.08)", color: "#1B2B4B" };
            return (
              <div style={{ marginBottom: "12px" }}>
                <span style={{ display: "inline-block", fontSize: "12px", fontWeight: 700, padding: "6px 14px", borderRadius: "100px", textTransform: "uppercase", letterSpacing: "0.06em", background: s.background, color: s.color }}>
                  {STATUS_LABEL[deal.status] || deal.status}
                </span>
              </div>
            );
          })()}

          {/* Deal Status */}
          {(() => {
            const funded       = deal?.amount_funded ?? 0;
            const requested    = deal?.amount_requested ?? 0;
            const pct          = requested > 0 ? Math.round((funded / requested) * 100) : 0;
            const oversubscribed = funded > requested && requested > 0;
            const overage      = funded - requested;
            const amtLabel     = pct === 0
              ? "0% Funded · Open for bids"
              : oversubscribed
              ? "Oversubscribed"
              : pct >= 100
              ? "100% Funded"
              : `${pct}% Funded`;
            return (
              <div className="deal-status">
                <div className="deal-status-label">Deal Status</div>
                <div className="deal-status-amount">{amtLabel}</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                </div>
                <div className="deal-status-footer">
                  <span>{formatCurrency(funded)} funded</span>
                  <span>
                    {oversubscribed
                      ? `${formatCurrency(overage)} over`
                      : pct >= 100
                      ? "$0 remaining"
                      : `${formatCurrency(requested - funded)} remaining`}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </button>
            <button
              className={`tab ${activeTab === "sources" ? "active" : ""}`}
              onClick={() => setActiveTab("sources")}
            >
              Sources & Uses
            </button>
            <button
              className={`tab ${activeTab === "credit" ? "active" : ""}`}
              onClick={() => setActiveTab("credit")}
            >
              Credit Analysis
            </button>
            <button
              className={`tab ${activeTab === "bids" ? "active" : ""}`}
              onClick={() => setActiveTab("bids")}
            >
              Bids
            </button>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="tab-content active">
              <div className="overview-grid">
                <div className="card">
                  <div className="card-title">Loan Details</div>
                  <div className="card-section">
                    <div className="card-item">
                      <div className="card-label">Loan Amount</div>
                      <div className="card-value">{deal?.amount_requested ? `$${Number(deal.amount_requested).toLocaleString()}` : DEAL.loanAmount}</div>
                    </div>
                    <div className="card-item">
                      <div className="card-label">Term</div>
                      <div className="card-value-small">{deal?.term_months ? `${deal.term_months} months` : DEAL.term}</div>
                    </div>
                    <div className="card-item">
                      <div className="card-label">Target Rate</div>
                      <div className="card-value-small">{deal?.interest_rate ? `${deal.interest_rate}%` : DEAL.targetRate}</div>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-title">Company Metrics</div>
                  <div className="card-section">
                    <div className="card-item">
                      <div className="card-label">Annual Revenue</div>
                      <div className="card-value">{deal?.annual_revenue ? `$${Number(deal.annual_revenue).toLocaleString()}` : DEAL.annualRevenue}</div>
                    </div>
                    <div className="card-item">
                      <div className="card-label">EBITDA</div>
                      <div className="card-value-small">{deal?.ebitda ? `$${Number(deal.ebitda).toLocaleString()}` : DEAL.ebitda}</div>
                    </div>
                    <div className="card-item">
                      <div className="card-label">Years Operating</div>
                      <div className="card-value-small">
                        {deal?.years_in_business || DEAL.yearsOperating}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {computedMetrics.length > 0 && (() => {
                const pit = computedMetrics.filter(m => m.fiscal_year != null);
                const growth = computedMetrics.filter(m => m.fiscal_year == null);
                const fyLabel = pit[0]?.fiscal_year ? ` — FY${pit[0].fiscal_year}` : "";
                return (
                  <div className="card">
                    <div className="card-title">Key Financial Ratios</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>
                      From confirmed financial statements{fyLabel}
                    </div>
                    {pit.map(m => (
                      <div key={m.metric_key} className="ratio-row">
                        <span className="ratio-label">{m.metric_label}</span>
                        <div className="ratio-right">
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy)" }}>{m.value}{m.unit}</span>
                          {m.benchmark_status === "strong" && <span className="badge-strong">Strong</span>}
                          {m.benchmark_status === "adequate" && <span className="badge-adequate">Adequate</span>}
                          {m.benchmark_status === "weak" && <span className="badge-weak">Weak</span>}
                        </div>
                      </div>
                    ))}
                    {growth.length > 0 && (
                      <>
                        <div className="ratio-subhead">Year-over-Year</div>
                        {growth.map(m => (
                          <div key={m.metric_key} className="ratio-row">
                            <span className="ratio-label">{m.metric_label}</span>
                            <div className="ratio-right">
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy)" }}>{m.value}{m.unit}</span>
                              {m.benchmark_status === "strong" && <span className="badge-strong">Strong</span>}
                              {m.benchmark_status === "adequate" && <span className="badge-adequate">Adequate</span>}
                              {m.benchmark_status === "weak" && <span className="badge-weak">Weak</span>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Sources & Uses Tab */}
          {activeTab === "sources" && (
            <div className="tab-content active">
              <div className="card">
                <div className="card-title">Sources & Uses</div>
                <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "24px", fontStyle: "italic" }}>
                  Sources & Uses breakdown will be available once detailed financial documentation is processed.
                </p>
                <div className="card-section">
                  <div className="card-item">
                    <div className="card-label">Requested Amount</div>
                    <div className="card-value">
                      {deal?.amount_requested ? `$${Number(deal.amount_requested).toLocaleString()}` : "—"}
                    </div>
                  </div>
                  {deal?.ai_summary && (
                    <div className="card-item">
                      <div className="card-label">Use of Funds</div>
                      <div className="card-value-small" style={{ lineHeight: 1.65, marginTop: "4px" }}>{deal.ai_summary}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Credit Analysis Tab */}
          {activeTab === "credit" && (
            <div className="tab-content active">
              {creditScore ? (
                <>
                  {/* AI Score Header */}
                  <div className="card" style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px", marginBottom: "20px" }}>
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "6px" }}>✦ Junni AI Credit Score</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "56px", fontWeight: 800, color: "var(--navy)", lineHeight: 1, letterSpacing: "-2px" }}>{creditScore.overall_score}</span>
                          <span style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-muted)" }}>/100</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "8px" }}>Risk Assessment</div>
                        <div style={{
                          display: "inline-block",
                          padding: "6px 16px",
                          borderRadius: "100px",
                          fontSize: "13px",
                          fontWeight: 700,
                          background: creditScore.risk_label === "Very Low" || creditScore.risk_label === "Low" ? "rgba(5,150,105,0.1)" : creditScore.risk_label === "Moderate" ? "rgba(217,119,6,0.1)" : "rgba(220,38,38,0.1)",
                          color: creditScore.risk_label === "Very Low" || creditScore.risk_label === "Low" ? "var(--success)" : creditScore.risk_label === "Moderate" ? "var(--warning)" : "var(--danger)",
                        }}>{creditScore.risk_label} Risk</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {toParas(creditScore.summary).map((chunk, i) => (
                        <p key={i}>{chunk}</p>
                      ))}
                    </div>
                  </div>

                  {/* Strengths & Risks */}
                  <div className="overview-grid" style={{ marginBottom: "20px" }}>
                    <div className="card">
                      <div className="card-title" style={{ color: "var(--success)", fontSize: "15px" }}>✓ Strengths</div>
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {creditScore.strengths.map((s: string, i: number) => (
                          <li key={i} style={{ display: "flex", gap: "10px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            <span style={{ color: "var(--success)", fontWeight: 700, flexShrink: 0 }}>✓</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="card">
                      <div className="card-title" style={{ color: "var(--danger)", fontSize: "15px" }}>⚠ Risks</div>
                      <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {creditScore.risks.map((r: string, i: number) => (
                          <li key={i} style={{ display: "flex", gap: "10px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                            <span style={{ color: "var(--warning)", fontWeight: 700, flexShrink: 0 }}>⚠</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Metric Score Bars */}
                  <div className="card">
                    <div className="card-title">Credit Factor Scores</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {Object.entries(creditScore.metrics).map(([key, val]: [string, any]) => {
                        const label = key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                        const pct = Math.min(100, Math.max(0, Number(val)));
                        const barColor = pct >= 70 ? "var(--success)" : pct >= 45 ? "var(--gold)" : "var(--danger)";
                        return (
                          <div key={key}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "var(--navy)", marginBottom: "6px" }}>
                              <span>{label}</span>
                              <span style={{ color: barColor }}>{pct}/100</span>
                            </div>
                            <div style={{ height: "6px", background: "rgba(27,43,75,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "4px", transition: "width 0.4s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Financial Ratios */}
                  {computedMetrics.length > 0 && (() => {
                    const pit = computedMetrics.filter(m => m.fiscal_year != null);
                    const growth = computedMetrics.filter(m => m.fiscal_year == null);
                    const fyLabel = pit[0]?.fiscal_year ? ` — FY${pit[0].fiscal_year}` : "";
                    return (
                      <div className="card" style={{ marginTop: "20px" }}>
                        <div className="card-title">Financial Ratios{fyLabel}</div>
                        {pit.map(m => (
                          <div key={m.metric_key} className="ratio-row">
                            <span className="ratio-label">{m.metric_label}</span>
                            <div className="ratio-right">
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy)" }}>{m.value}{m.unit}</span>
                              {m.benchmark_status === "strong" && <span className="badge-strong">Strong</span>}
                              {m.benchmark_status === "adequate" && <span className="badge-adequate">Adequate</span>}
                              {m.benchmark_status === "weak" && <span className="badge-weak">Weak</span>}
                            </div>
                          </div>
                        ))}
                        {growth.length > 0 && (
                          <>
                            <div className="ratio-subhead">Year-over-Year</div>
                            {growth.map(m => (
                              <div key={m.metric_key} className="ratio-row">
                                <span className="ratio-label">{m.metric_label}</span>
                                <div className="ratio-right">
                                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy)" }}>{m.value}{m.unit}</span>
                                  {m.benchmark_status === "strong" && <span className="badge-strong">Strong</span>}
                                  {m.benchmark_status === "adequate" && <span className="badge-adequate">Adequate</span>}
                                  {m.benchmark_status === "weak" && <span className="badge-weak">Weak</span>}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </>
              ) : null}

              {/* Borrower Q&A */}
              {answeredQuestions.length > 0 && dbUser?.id && dbUser.id !== deal?.borrower_id && (
                <div style={{ marginTop: "20px" }}>
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "17px", fontWeight: 700, color: "var(--navy)", marginBottom: "4px" }}>Borrower Q&A</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Questions raised during analysis and the borrower's responses.</div>
                  </div>
                  {answeredQuestions.map((q: any) => {
                    const isResolved = String(q.answer_assessment ?? "").startsWith("Resolved");
                    const reasoning = String(q.answer_assessment ?? "").replace(/^(?:Not resolved|Resolved)\s*[—-]\s*/i, "");
                    return (
                      <div key={q.id} style={{
                        background: "var(--white)",
                        border: "1px solid var(--border)",
                        borderLeft: `4px solid ${isResolved ? "var(--success)" : "var(--warning)"}`,
                        borderRadius: "10px",
                        marginBottom: "12px",
                        overflow: "hidden",
                      }}>
                        <div style={{ padding: "14px 16px 0", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "4px",
                            textTransform: "uppercase", letterSpacing: "0.04em",
                            background: q.source === "rule" ? "rgba(212,148,10,0.12)" : "rgba(27,43,75,0.08)",
                            color: q.source === "rule" ? "var(--gold)" : "var(--navy)",
                          }}>{q.source}</span>
                          {q.related_metric && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>{q.related_metric}</span>
                          )}
                          <span style={{
                            marginLeft: "auto",
                            fontSize: "10px", fontWeight: 700, padding: "2px 10px", borderRadius: "100px",
                            background: isResolved ? "rgba(5,150,105,0.1)" : "rgba(217,119,6,0.1)",
                            color: isResolved ? "var(--success)" : "var(--warning)",
                          }}>{isResolved ? "Resolved" : "Not Resolved"}</span>
                        </div>
                        <div style={{ padding: "10px 16px 8px", fontSize: "13px", fontWeight: 600, color: "var(--navy)", lineHeight: 1.55 }}>
                          {q.question_text}
                        </div>
                        <div style={{ margin: "0 16px 10px", padding: "10px 12px", background: "rgba(27,43,75,0.03)", borderRadius: "8px", borderLeft: "2px solid var(--border)" }}>
                          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: "5px" }}>Borrower's response</div>
                          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{q.answer}</div>
                        </div>
                        <div style={{ padding: "0 16px 14px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "12px", flexShrink: 0, color: isResolved ? "var(--success)" : "var(--warning)", fontWeight: 700 }}>
                            {isResolved ? "✓" : "⚠"}
                          </span>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.6, fontStyle: "italic" }}>{reasoning}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Active Bids Tab */}
          {activeTab === "bids" && (
            <div className="tab-content active">
              {dealBids.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>No bids yet.</div>
              ) : (
                dealBids.map((bid) => (
                  <div key={bid.id} className="bid-item">
                    <div className="bid-lender">
                      <div className="bid-lender-name">{formatLenderId(String(bid.lender_id), bid.lender_number)}</div>
                      <div className="bid-lender-type">{bid.term_months ? `${bid.term_months} mo term` : ""}</div>
                    </div>
                    <div className="bid-right">
                      <div className="bid-rate">{bid.interest_rate}%</div>
                      <div className="bid-details">
                        <span className="bid-amount">${Number(bid.amount).toLocaleString()}</span>
                        <span className={`bid-status ${bid.status?.toLowerCase()}`}>{bid.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Bid Form */}
          {(deal?.status === 'funded' || deal?.status === 'closed' || deal?.status === 'rejected') ? (
            <div className="sidebar-card">
              <div style={{ padding: "8px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", lineHeight: 1.6 }}>
                This deal is closed and no longer accepting bids.
              </div>
            </div>
          ) : (
            <div className="sidebar-card">
              <div className="sidebar-card-title">Submit a Bid</div>
              <div className="bid-form">
                <div className="form-group">
                  <label className="form-label">Interest Rate (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 7.2"
                    step="0.1"
                    min="5"
                    max="12"
                    value={bidRate}
                    onChange={(e) => setBidRate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 250000"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Term (Months)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder={deal?.term_months ? String(deal.term_months) : "36"}
                    value={bidTerm}
                    onChange={(e) => setBidTerm(e.target.value)}
                  />
                </div>
                <div className="form-hint">Rate range: {deal?.interest_rate ? `${deal.interest_rate}%` : "6.2% – 8.8%"}</div>
                <button
                  type="button"
                  className="btn-submit"
                  onClick={handleBidSubmit}
                  disabled={submittingBid}
                >
                  {submittingBid ? "Submitting..." : "Place Bid"}
                </button>
              </div>
            </div>
          )}

          {/* Deal Summary */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">Deal Summary</div>
            <div className="sidebar-stat">
              <span className="sidebar-stat-label">Funded</span>
              <span className="sidebar-stat-val">
                {deal?.amount_requested > 0
                  ? `${Math.round(((deal.amount_funded ?? 0) / deal.amount_requested) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="sidebar-stat">
              <span className="sidebar-stat-label">Remaining</span>
              <span className="sidebar-stat-val">
                {deal?.amount_requested
                  ? formatCurrency(deal.amount_requested - (deal.amount_funded ?? 0))
                  : "—"}
              </span>
            </div>
            <div className="sidebar-stat">
              <span className="sidebar-stat-label">Active Bids</span>
              <span className="sidebar-stat-val">{dealBids.length}</span>
            </div>
            <div className="sidebar-stat">
              <span className="sidebar-stat-label">Best Rate</span>
              <span className="sidebar-stat-val">
                {dealBids.length > 0
                  ? `${Math.min(...dealBids.map((b) => b.interest_rate))}%`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Documents */}
          <div className="sidebar-card">
            <div className="sidebar-card-title">Documents</div>
            {dealDocs.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "8px 0" }}>No documents uploaded.</div>
            ) : (
              dealDocs.map((doc, idx) => (
                <div key={idx} className="doc-item">
                  <div className="doc-icon-and-text">
                    <span className="doc-icon">📄</span>
                    <div>
                      <div className="doc-name">{doc.file_name}</div>
                      <div className="doc-type">{doc.file_type}</div>
                    </div>
                  </div>
                  <button className="btn-view" onClick={async () => {
                    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 3600);
                    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                  }}>
                    View
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Document Modal */}
      {showDocModal && (
        <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Document Preview</div>
            <div className="modal-text">
              Document preview not available in demo mode.
            </div>
            <button
              className="modal-btn"
              onClick={() => setShowDocModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
