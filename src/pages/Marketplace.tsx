import { useState, useEffect } from "react";
import { supabase } from '../lib/supabase';

const LOGO_BEIGE = "/manus-storage/junni-logo-beige_95169244.png";

const DEMO_DEALS = [
  {
    id: "demo-1",
    company: "Maple Ridge Mfg",
    risk: "Very Low Risk",
    riskClass: "low-risk",
    amount: "$3.2M",
    amountRaw: 3200000,
    rateRange: "6.8–7.2%",
    location: "Ontario",
    industry: "Manufacturing",
    term: "36 months",
    termMonths: 36,
    funded: 78,
    lenders: 12,
    activeBids: 12,
    isDemo: true,
  },
  {
    id: "demo-2",
    company: "Prairie Health Clinics",
    risk: "Very Low Risk",
    riskClass: "low-risk",
    amount: "$1.8M",
    amountRaw: 1800000,
    rateRange: "7.1–7.5%",
    location: "Saskatchewan",
    industry: "Healthcare",
    term: "24 months",
    termMonths: 24,
    funded: 45,
    lenders: 8,
    activeBids: 8,
    isDemo: true,
  },
  {
    id: "demo-3",
    company: "Cascade Logistics",
    risk: "Medium Risk",
    riskClass: "medium-risk",
    amount: "$2.5M",
    amountRaw: 2500000,
    rateRange: "8.0–8.5%",
    location: "Alberta",
    industry: "Logistics",
    term: "36 months",
    termMonths: 36,
    funded: 62,
    lenders: 15,
    activeBids: 15,
    isDemo: true,
  },
  {
    id: "demo-4",
    company: "Summit Tech Solutions",
    risk: "Very Low Risk",
    riskClass: "low-risk",
    amount: "$4.1M",
    amountRaw: 4100000,
    rateRange: "6.5–7.0%",
    location: "British Columbia",
    industry: "Technology",
    term: "48 months",
    termMonths: 48,
    funded: 91,
    lenders: 18,
    activeBids: 18,
    isDemo: true,
  },
  {
    id: "demo-5",
    company: "Riverdale Retail Group",
    risk: "Medium Risk",
    riskClass: "medium-risk",
    amount: "$1.2M",
    amountRaw: 1200000,
    rateRange: "8.3–8.8%",
    location: "Quebec",
    industry: "Retail",
    term: "24 months",
    termMonths: 24,
    funded: 38,
    lenders: 6,
    activeBids: 6,
    isDemo: true,
  },
  {
    id: "demo-6",
    company: "North Star Energy",
    risk: "Very Low Risk",
    riskClass: "low-risk",
    amount: "$5.8M",
    amountRaw: 5800000,
    rateRange: "6.9–7.3%",
    location: "Manitoba",
    industry: "Energy",
    term: "60 months",
    termMonths: 60,
    funded: 85,
    lenders: 22,
    activeBids: 22,
    isDemo: true,
  },
];

const INDUSTRIES = [
  "All Industries",
  "Technology",
  "Healthcare",
  "Manufacturing",
  "Retail",
  "Logistics",
  "Energy",
  "Construction",
  "Real Estate",
  "Food & Beverage",
  "Financial Services",
  "Other",
];

const RISK_TIERS = ["All Risk Tiers", "Very Low", "Low", "Medium", "High"];
const TERMS = ["Any Term", "Under 12 mo", "12–24 mo", "24–48 mo", "48+ mo"];
const AMOUNTS = ["Any Amount", "Under $1M", "$1M–$5M", "$5M–$10M", "$10M+"];

function formatAmount(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function getRiskLabel(score: number | null): { label: string; class: string } {
  if (!score) return { label: "Pending Review", class: "pending-risk" };
  if (score >= 80) return { label: "Very Low Risk", class: "low-risk" };
  if (score >= 65) return { label: "Low Risk", class: "low-risk" };
  if (score >= 50) return { label: "Medium Risk", class: "medium-risk" };
  return { label: "Higher Risk", class: "high-risk" };
}

function getIndustryEmoji(industry: string): string {
  const map: Record<string, string> = {
    Manufacturing: "⚙️",
    Healthcare: "🏥",
    Logistics: "🚚",
    Technology: "💻",
    Retail: "🛍️",
    Energy: "⚡",
    Construction: "🏗️",
    "Real Estate": "🏢",
    "Food & Beverage": "🍽️",
    "Financial Services": "💼",
  };
  return map[industry] || "🏬";
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("All Industries");
  const [selectedRisk, setSelectedRisk] = useState("All Risk Tiers");
  const [selectedTerm, setSelectedTerm] = useState("Any Term");
  const [selectedAmount, setSelectedAmount] = useState("Any Amount");
  const [currentPage, setCurrentPage] = useState(1);
  const [realDeals, setRealDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const DEALS_PER_PAGE = 6;

  useEffect(() => {
    async function fetchDeals() {
      try {
        const { data, error } = await supabase
          .from('deals')
          .select(`
            id,
            title,
            industry,
            amount_requested,
            term_months,
            interest_rate,
            status,
            ai_score,
            province,
            city,
            annual_revenue,
            ebitda,
            years_in_business,
            ai_summary,
            created_at
          `)
          .in('status', ['active', 'pending'])
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching deals:', error);
        } else if (data) {
          const formatted = data.map((d: any) => {
            const risk = getRiskLabel(d.ai_score);
            return {
              id: d.id,
              company: d.title || 'Unnamed Deal',
              risk: risk.label,
              riskClass: risk.class,
              amount: formatAmount(d.amount_requested),
              amountRaw: d.amount_requested,
              rateRange: d.interest_rate ? `${d.interest_rate}%` : 'Market Rate',
              location: d.province || d.city || 'Canada',
              industry: d.industry || 'Other',
              term: `${d.term_months} months`,
              termMonths: d.term_months,
              funded: 0,
              lenders: 0,
              activeBids: 0,
              isDemo: false,
            };
          });
          setRealDeals(formatted);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDeals();
  }, []);

  const allDeals = [...realDeals, ...DEMO_DEALS];

  const filteredDeals = allDeals.filter((deal) => {
    const matchesSearch =
      deal.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.industry.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesIndustry =
      selectedIndustry === "All Industries" ||
      deal.industry === selectedIndustry;

    const matchesRisk =
      selectedRisk === "All Risk Tiers" ||
      (selectedRisk === "Very Low" && deal.risk === "Very Low Risk") ||
      (selectedRisk === "Low" && deal.risk === "Low Risk") ||
      (selectedRisk === "Medium" && deal.risk === "Medium Risk") ||
      (selectedRisk === "High" && deal.risk === "Higher Risk");

    const matchesTerm =
      selectedTerm === "Any Term" ||
      (selectedTerm === "Under 12 mo" && deal.termMonths < 12) ||
      (selectedTerm === "12–24 mo" && deal.termMonths >= 12 && deal.termMonths <= 24) ||
      (selectedTerm === "24–48 mo" && deal.termMonths > 24 && deal.termMonths <= 48) ||
      (selectedTerm === "48+ mo" && deal.termMonths > 48);

    const matchesAmount =
      selectedAmount === "Any Amount" ||
      (selectedAmount === "Under $1M" && deal.amountRaw < 1000000) ||
      (selectedAmount === "$1M–$5M" && deal.amountRaw >= 1000000 && deal.amountRaw <= 5000000) ||
      (selectedAmount === "$5M–$10M" && deal.amountRaw > 5000000 && deal.amountRaw <= 10000000) ||
      (selectedAmount === "$10M+" && deal.amountRaw > 10000000);

    return matchesSearch && matchesIndustry && matchesRisk && matchesTerm && matchesAmount;
  });

  const totalPages = Math.ceil(filteredDeals.length / DEALS_PER_PAGE);
  const paginatedDeals = filteredDeals.slice(
    (currentPage - 1) * DEALS_PER_PAGE,
    currentPage * DEALS_PER_PAGE
  );

  return (
    <div className="junni-marketplace">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

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
        }

        .junni-marketplace {
          font-family: 'Inter', sans-serif;
          color: var(--text-secondary);
          background-color: var(--cream);
          min-height: 100vh;
        }

        .junni-marketplace nav {
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

        .junni-marketplace nav .logo img { height: 72px; width: auto; }

        .junni-marketplace .nav-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .junni-marketplace .nav-user {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--navy);
          font-size: 13px;
          font-weight: 600;
        }

        .junni-marketplace .nav-user:hover { color: var(--gold); }

        .junni-marketplace .hero-banner {
          background: var(--navy);
          padding: 40px;
        }

        .junni-marketplace .hero-banner-inner {
          max-width: 1400px;
          margin: 0 auto;
        }

        .junni-marketplace .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(212, 148, 10, 0.15);
          border: 1px solid rgba(212, 148, 10, 0.3);
          border-radius: 100px;
          padding: 6px 14px;
          margin-bottom: 16px;
        }

        .junni-marketplace .hero-eyebrow-dot {
          width: 6px;
          height: 6px;
          background: var(--gold);
          border-radius: 50%;
        }

        .junni-marketplace .hero-eyebrow span {
          font-size: 11px;
          font-weight: 700;
          color: var(--gold-light);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .junni-marketplace .marketplace-header h1 {
          font-family: 'Fraunces', serif;
          font-size: 38px;
          font-weight: 800;
          color: var(--white);
          margin-bottom: 8px;
          letter-spacing: -0.03em;
        }

        .junni-marketplace .marketplace-header p {
          font-size: 15px;
          color: rgba(255,255,255,0.6);
          max-width: 550px;
        }

        .junni-marketplace .filters-bar {
          background: var(--white);
          border-bottom: 1px solid var(--border);
          padding: 16px 40px;
          position: sticky;
          top: 80px;
          z-index: 90;
        }

        .junni-marketplace .filters-bar-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .junni-marketplace .filter-count {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          white-space: nowrap;
          margin-left: auto;
        }

        .junni-marketplace .search-box {
          flex: 1;
          min-width: 250px;
          position: relative;
        }

        .junni-marketplace .search-box input {
          width: 100%;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: var(--navy);
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px 12px 40px;
          outline: none;
          transition: border-color 0.2s;
        }

        .junni-marketplace .search-box input:focus { border-color: var(--navy); }
        .junni-marketplace .search-box input::placeholder { color: var(--text-muted); }

        .junni-marketplace .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-size: 16px;
        }

        .junni-marketplace .filter-select {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 32px 10px 14px;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237A7060' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 10px center;
        }

        .junni-marketplace .filter-select:focus { border-color: var(--navy); outline: none; }

        .junni-marketplace .marketplace-wrapper {
          padding: 32px 40px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .junni-marketplace .loading-state {
          text-align: center;
          padding: 80px 20px;
          color: var(--text-muted);
          font-size: 15px;
        }

        .junni-marketplace .deals-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 40px;
        }

        .junni-marketplace .deal-card {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .junni-marketplace .deal-card:hover {
          border-color: var(--gold);
          box-shadow: 0 8px 32px rgba(27,43,75,0.12);
        }

        .junni-marketplace .real-deal-tag {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(5,150,105,0.1);
          color: var(--success);
          font-size: 9px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 100px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .junni-marketplace .deal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .junni-marketplace .deal-company {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 800;
          color: var(--navy);
          letter-spacing: -0.03em;
          padding-right: 8px;
        }

        .junni-marketplace .deal-badge {
          background: rgba(5,150,105,0.08);
          color: var(--success);
          font-size: 10px;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 100px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .junni-marketplace .deal-badge.medium-risk {
          background: rgba(217,119,6,0.1);
          color: var(--warning);
        }

        .junni-marketplace .deal-badge.high-risk {
          background: rgba(220,38,38,0.08);
          color: var(--danger);
        }

        .junni-marketplace .deal-badge.pending-risk {
          background: rgba(37,99,235,0.08);
          color: #2563EB;
        }

        .junni-marketplace .deal-info {
          display: flex;
          gap: 20px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .junni-marketplace .deal-info-item { flex: 1; }

        .junni-marketplace .deal-info-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .junni-marketplace .deal-info-value {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 800;
          color: var(--navy);
          letter-spacing: -0.03em;
        }

        .junni-marketplace .deal-meta {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          font-size: 12px;
          color: var(--text-muted);
          flex-wrap: wrap;
        }

        .junni-marketplace .deal-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .junni-marketplace .deal-progress { margin-bottom: 20px; }

        .junni-marketplace .progress-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }

        .junni-marketplace .progress-bar {
          height: 4px;
          background: rgba(27,43,75,0.08);
          border-radius: 4px;
          overflow: hidden;
        }

        .junni-marketplace .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--navy), #3D5A8A);
          border-radius: 4px;
        }

        .junni-marketplace .deal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--border);
        }

        .junni-marketplace .deal-bids {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .junni-marketplace .deal-btn {
          background: var(--navy);
          color: var(--white);
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-family: 'Inter', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .junni-marketplace .deal-btn:hover { opacity: 0.85; }

        .junni-marketplace .pagination {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 40px;
        }

        .junni-marketplace .pagination button,
        .junni-marketplace .pagination a {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 12px;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }

        .junni-marketplace .pagination button:hover,
        .junni-marketplace .pagination a:hover {
          border-color: var(--gold);
          color: var(--gold);
        }

        .junni-marketplace .pagination .active {
          background: var(--navy);
          border-color: var(--navy);
          color: var(--white);
        }

        .junni-marketplace .pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 1024px) {
          .junni-marketplace .deals-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 768px) {
          .junni-marketplace nav { padding: 0 20px; height: 70px; }
          .junni-marketplace nav .logo img { height: 50px; }
          .junni-marketplace .hero-banner { padding: 24px 20px; }
          .junni-marketplace .marketplace-header h1 { font-size: 28px; }
          .junni-marketplace .filters-bar { padding: 12px 20px; position: static; }
          .junni-marketplace .filters-bar-inner { flex-direction: column; }
          .junni-marketplace .search-box { min-width: unset; width: 100%; }
          .junni-marketplace .filter-select { width: 100%; }
          .junni-marketplace .filter-count { margin-left: 0; width: 100%; text-align: center; }
          .junni-marketplace .marketplace-wrapper { padding: 20px; }
          .junni-marketplace .deals-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Navigation */}
      <nav>
        <a href="/" className="logo">
          <img src={LOGO_BEIGE} alt="Junni" />
        </a>
        <div className="nav-right">
          <a href="/lender-portfolio" className="nav-user">Portfolio</a>
          <a href="/lender-dashboard" className="nav-user">Dashboard</a>
        </div>
      </nav>

      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="hero-banner-inner">
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-dot"></div>
            <span>Live Marketplace</span>
          </div>
          <div className="marketplace-header">
            <h1>Active Debt Opportunities</h1>
            <p>AI-scored, institution-ready SME debt deals. Every listing includes a full credit memo and transparent risk assessment.</p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="filters-bar">
        <div className="filters-bar-inner">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search companies, industries..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <select className="filter-select" value={selectedIndustry} onChange={(e) => { setSelectedIndustry(e.target.value); setCurrentPage(1); }}>
            {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
          </select>
          <select className="filter-select" value={selectedRisk} onChange={(e) => { setSelectedRisk(e.target.value); setCurrentPage(1); }}>
            {RISK_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
          </select>
          <select className="filter-select" value={selectedTerm} onChange={(e) => { setSelectedTerm(e.target.value); setCurrentPage(1); }}>
            {TERMS.map((term) => <option key={term} value={term}>{term}</option>)}
          </select>
          <select className="filter-select" value={selectedAmount} onChange={(e) => { setSelectedAmount(e.target.value); setCurrentPage(1); }}>
            {AMOUNTS.map((amt) => <option key={amt} value={amt}>{amt}</option>)}
          </select>
          <span className="filter-count">{filteredDeals.length} deals found</span>
        </div>
      </div>

      {/* Marketplace */}
      <div className="marketplace-wrapper">
        {loading ? (
          <div className="loading-state">Loading deals...</div>
        ) : (
          <>
            <div className="deals-grid">
              {paginatedDeals.map((deal) => (
                <a
                  key={deal.id}
                  href={deal.isDemo ? `/deals/${deal.id}` : `/deals/${deal.id}`}
                  className="deal-card"
                >
                  {!deal.isDemo && <span className="real-deal-tag">Live</span>}
                  <div className="deal-header">
                    <div className="deal-company">{deal.company}</div>
                    <div className={`deal-badge ${deal.riskClass}`}>{deal.risk}</div>
                  </div>
                  <div className="deal-info">
                    <div className="deal-info-item">
                      <div className="deal-info-label">Loan Amount</div>
                      <div className="deal-info-value">{deal.amount}</div>
                    </div>
                    <div className="deal-info-item">
                      <div className="deal-info-label">Rate</div>
                      <div className="deal-info-value" style={{ fontSize: '16px' }}>{deal.rateRange}</div>
                    </div>
                  </div>
                  <div className="deal-meta">
                    <div className="deal-meta-item">📍 {deal.location}</div>
                    <div className="deal-meta-item">{getIndustryEmoji(deal.industry)} {deal.industry}</div>
                    <div className="deal-meta-item">📅 {deal.term}</div>
                  </div>
                  <div className="deal-progress">
                    <div className="progress-label">
                      {deal.funded}% funded • {deal.lenders} lenders bidding
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${deal.funded}%` }}></div>
                    </div>
                  </div>
                  <div className="deal-footer">
                    <div className="deal-bids">{deal.activeBids} active bids</div>
                    <button type="button" className="deal-btn">View Deal</button>
                  </div>
                </a>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <a key={page} className={currentPage === page ? "active" : ""} onClick={() => setCurrentPage(page)} style={{ cursor: 'pointer' }}>{page}</a>
                ))}
                <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
