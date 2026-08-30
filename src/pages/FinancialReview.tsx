import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase, invokeFunction } from "../lib/supabase";
import { useParams, useLocation } from "wouter";
import { useLanguage } from "../contexts/LanguageContext";

const LOGO_BEIGE = "/junni-logo-beige.png";

const NUMERIC_FIELDS: { key: string; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "cogs", label: "COGS" },
  { key: "gross_profit", label: "Gross Profit" },
  { key: "operating_expenses", label: "Operating Expenses" },
  { key: "ebitda", label: "EBITDA" },
  { key: "net_income", label: "Net Income" },
  { key: "total_assets", label: "Total Assets" },
  { key: "current_assets", label: "Current Assets" },
  { key: "total_liabilities", label: "Total Liabilities" },
  { key: "current_liabilities", label: "Current Liabilities" },
  { key: "total_debt", label: "Total Debt" },
  { key: "equity", label: "Equity" },
  { key: "interest_expense", label: "Interest Expense" },
];

type Edits = Record<string, Record<string, number | null>>;

type DebtFields = {
  long_term: number | null;
  current_portion: number | null;
  rates: string;
  maturities: string;
  description: string;
};
type DebtEdits = Record<string, DebtFields>;

export default function FinancialReview() {
  const params = useParams<{ id: string }>();
  const dealId = params.id;
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth0();

  const { t, lang } = useLanguage();
  const dateLocale = lang === "fr" ? "fr-CA" : "en-CA";
  const [deal, setDeal] = useState<any>(null);
  const [financials, setFinancials] = useState<any[]>([]);
  const [edits, setEdits] = useState<Edits>({});
  const [debtEdits, setDebtEdits] = useState<DebtEdits>({});
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [dbUser, setDbUser] = useState<any>(null);
  const [showRawNotes, setShowRawNotes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wasAlreadyConfirmed, setWasAlreadyConfirmed] = useState(false);
  const [isRescoring, setIsRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);
  const [newNoteYear, setNewNoteYear] = useState("general");
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [dealRes, financialsRes, annotationsRes] = await Promise.all([
        supabase.from("deals").select("id, title, financials_status").eq("id", dealId).single(),
        supabase
          .from("extracted_financials")
          .select("*")
          .eq("deal_id", dealId)
          .order("fiscal_year", { ascending: false }),
        supabase
          .from("financial_annotations")
          .select("*")
          .eq("deal_id", dealId)
          .order("created_at", { ascending: true }),
      ]);

      if (dealRes.data) setDeal(dealRes.data);

      if (financialsRes.data) {
        setFinancials(financialsRes.data);
        const initial: Edits = {};
        const initialDebt: DebtEdits = {};
        for (const row of financialsRes.data) {
          initial[row.id] = {};
          for (const { key } of NUMERIC_FIELDS) {
            initial[row.id][key] = row[key] ?? null;
          }
          const dd = row.debt_detail ?? {};
          initialDebt[row.id] = {
            long_term: dd.long_term ?? null,
            current_portion: dd.current_portion ?? null,
            rates: dd.rates ?? "",
            maturities: dd.maturities ?? "",
            description: dd.description ?? "",
          };
        }
        setEdits(initial);
        setDebtEdits(initialDebt);
        if (financialsRes.data.some((r: any) => r.borrower_confirmed)) setWasAlreadyConfirmed(true);
      }

      if (annotationsRes.data) setAnnotations(annotationsRes.data);

      if (user?.sub) {
        const { data: userData } = await supabase
          .from("users")
          .select("id")
          .eq("auth0_id", user.sub)
          .single();
        if (userData) setDbUser(userData);
      }

      setLoading(false);
    };
    fetchData();
  }, [dealId, user?.sub]);

  const handleFieldChange = (financialId: string, field: string, raw: string) => {
    const val = raw === "" ? null : parseFloat(raw);
    setEdits(prev => ({
      ...prev,
      [financialId]: { ...prev[financialId], [field]: isNaN(val as number) ? null : val },
    }));
  };

  const handleDebtChange = (rowId: string, field: keyof DebtFields, raw: string) => {
    setDebtEdits(prev => {
      const curr = prev[rowId] ?? { long_term: null, current_portion: null, rates: "", maturities: "", description: "" };
      const isNumeric = field === "long_term" || field === "current_portion";
      const val = isNumeric
        ? (raw === "" ? null : (isNaN(parseFloat(raw)) ? null : parseFloat(raw)))
        : raw;
      return { ...prev, [rowId]: { ...curr, [field]: val } };
    });
  };

  const saveEdits = async (confirm: boolean) => {
    setIsSaving(true);
    setRescoreError(null);
    let saveOk = false;
    const confirmNow = confirm ? new Date().toISOString() : null;
    try {
      for (const row of financials) {
        const rowEdits = edits[row.id] ?? {};
        const update: Record<string, any> = { ...rowEdits };
        if (confirm) update.borrower_confirmed = true;

        // Assemble debt_detail jsonb from separate debt state
        const rowDebt = debtEdits[row.id];
        if (rowDebt !== undefined) {
          update.debt_detail = {
            long_term: rowDebt.long_term,
            current_portion: rowDebt.current_portion,
            rates: rowDebt.rates || null,
            maturities: rowDebt.maturities || null,
            description: rowDebt.description || null,
          };
        }
        if (confirm && dbUser?.id && confirmNow) {
          update.debt_detail_confirmed = true;
          update.debt_detail_confirmed_at = confirmNow;
          update.debt_detail_confirmed_by = dbUser.id;
        }

        const { error } = await supabase
          .from("extracted_financials")
          .update(update)
          .eq("id", row.id);
        if (error) console.error(`extracted_financials update error (FY${row.fiscal_year}):`, error);
      }
      if (confirm) {
        const { error } = await supabase
          .from("deals")
          .update({ financials_status: "confirmed" })
          .eq("id", dealId);
        if (error) console.error("deals financials_status update error:", error);
      }
      saveOk = true;
    } finally {
      setIsSaving(false);
    }
    if (confirm && saveOk) {
      setIsRescoring(true);
      try {
        const { error: scoreErr } = await invokeFunction("score-deal", { deal_id: dealId });
        if (scoreErr) {
          const body402 = await (scoreErr as any).context?.json().catch(() => null);
          if (body402?.error === "no_subscription") {
            setRescoreError(t("financialReview.rescoreErrorNoSub"));
          } else {
            console.error("[FinancialReview] rescore failed:", scoreErr);
            setRescoreError(t("financialReview.rescoreError"));
          }
        } else {
          setLocation(`/analysis/${dealId}`);
        }
      } finally {
        setIsRescoring(false);
      }
    }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim() || !dbUser) return;
    setAddingNote(true);
    const { data, error } = await supabase
      .from("financial_annotations")
      .insert({
        deal_id: dealId,
        fiscal_year: newNoteYear === "general" ? null : parseInt(newNoteYear),
        note: newNoteText.trim(),
        created_by: dbUser.id,
      })
      .select()
      .single();
    if (!error && data) {
      setAnnotations(prev => [...prev, data]);
      setNewNoteText("");
      setNewNoteYear("general");
    }
    setAddingNote(false);
  };

  const hasLowConfidence = financials.some(f => f.extraction_confidence === "low");

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F4", fontFamily: "Inter, sans-serif", color: "#1B2B4B", fontSize: "16px", fontWeight: 600 }}>
        Loading financials...
      </div>
    );
  }

  return (
    <div className="financial-review">
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --navy: #1B2B4B;
          --gold: #D4940A;
          --cream: #FAF8F4;
          --white: #FFFFFF;
          --border: #E8E2D9;
          --text-muted: #7A7060;
          --text-secondary: #4A4035;
          --success: #059669;
        }

        .financial-review {
          font-family: 'Inter', sans-serif;
          background: var(--cream);
          min-height: 100vh;
          color: var(--text-secondary);
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

        .nav-left { display: flex; align-items: center; gap: 24px; }
        .logo img { height: 72px; width: auto; }

        .nav-back {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .nav-back:hover { color: var(--navy); }

        .container {
          max-width: 860px;
          margin: 0 auto;
          padding: 48px 40px 80px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .page-header { display: flex; flex-direction: column; gap: 8px; }

        .page-header h1 {
          font-family: 'Fraunces', serif;
          font-size: 32px;
          font-weight: 700;
          color: var(--navy);
          line-height: 1.2;
        }

        .deal-subtitle {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .page-instruction {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
          max-width: 680px;
          margin-top: 4px;
        }

        .confidence-callout {
          background: rgba(212, 148, 10, 0.1);
          border: 1px solid rgba(212, 148, 10, 0.35);
          border-left: 4px solid var(--gold);
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 500;
          color: #8a6000;
        }

        .year-card {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .year-card.low-confidence {
          border-color: rgba(212, 148, 10, 0.4);
        }

        .year-card-header {
          background: var(--navy);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .fiscal-year {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--white);
        }

        .meta-labels { display: flex; flex-wrap: wrap; gap: 8px; }

        .meta-badge {
          background: rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 11px;
          font-weight: 500;
          text-transform: capitalize;
        }

        .meta-badge.currency {
          background: rgba(212, 148, 10, 0.25);
          border-color: rgba(212, 148, 10, 0.5);
          color: #F5C842;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .meta-badge.conf-high { color: #6ee7b7; border-color: rgba(110,231,183,0.4); }
        .meta-badge.conf-medium { color: #fcd34d; border-color: rgba(252,211,77,0.4); }
        .meta-badge.conf-low { color: #fca5a5; border-color: rgba(252,165,165,0.4); }

        .fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          padding: 8px 24px 16px;
        }

        .field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }

        .field-row:nth-last-child(-n+2) { border-bottom: none; }

        .field-row:nth-child(odd) { padding-right: 24px; border-right: 1px solid var(--border); }
        .field-row:nth-child(even) { padding-left: 24px; }

        .field-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .field-input {
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: var(--navy);
          background: var(--cream);
          width: 140px;
          text-align: right;
          outline: none;
          transition: border-color 0.15s ease;
          -moz-appearance: textfield;
        }

        .field-input::-webkit-outer-spin-button,
        .field-input::-webkit-inner-spin-button { -webkit-appearance: none; }

        .field-input:focus { border-color: var(--navy); background: var(--white); }

        .field-input.low-conf-input {
          border-color: var(--gold);
          background: rgba(212, 148, 10, 0.04);
        }

        .field-input.low-conf-input:focus { border-color: #a87000; }

        .notes-block {
          margin: 0 24px 20px;
          background: rgba(27, 43, 75, 0.03);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 14px 16px;
        }

        .notes-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }

        .notes-text {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.65;
        }

        .annotations-section {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .annotations-section h3 {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--navy);
        }

        .annotations-list { display: flex; flex-direction: column; gap: 12px; }

        .annotation-item {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .annotation-meta {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .annotation-note { font-size: 14px; color: var(--text-secondary); line-height: 1.55; }

        .add-annotation {
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid var(--border);
          padding-top: 20px;
        }

        .add-annotation-row { display: flex; align-items: center; gap: 10px; }

        .year-select {
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 7px 10px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: var(--navy);
          background: var(--cream);
          outline: none;
          cursor: pointer;
        }

        .year-select:focus { border-color: var(--navy); }

        .annotation-textarea {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          color: var(--text-secondary);
          background: var(--cream);
          resize: vertical;
          outline: none;
          line-height: 1.5;
          transition: border-color 0.15s ease;
        }

        .annotation-textarea:focus { border-color: var(--navy); background: var(--white); }

        .btn-add-note {
          align-self: flex-start;
          border: none;
          background: var(--navy);
          color: var(--white);
          padding: 9px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .btn-add-note:hover:not(:disabled) { opacity: 0.85; }
        .btn-add-note:disabled { opacity: 0.45; cursor: default; }

        .empty-state {
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          font-size: 15px;
          color: var(--text-muted);
        }

        .actions-bar {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 8px;
        }

        .btn-secondary {
          border: 1px solid var(--navy);
          background: transparent;
          color: var(--navy);
          padding: 11px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-secondary:hover:not(:disabled) { background: var(--navy); color: var(--white); }
        .btn-secondary:disabled { opacity: 0.45; cursor: default; }

        .btn-primary {
          border: none;
          background: var(--gold);
          color: var(--white);
          padding: 11px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .btn-primary:disabled { opacity: 0.45; cursor: default; }

        .debt-section {
          margin: 4px 24px 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }

        .debt-section-header {
          background: rgba(27,43,75,0.035);
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
          border-bottom: 1px solid var(--border);
        }

        .debt-section-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }

        .debt-status-confirmed { font-size: 11px; font-weight: 600; color: var(--success); }
        .debt-status-unreviewed { font-size: 11px; color: var(--text-muted); font-style: italic; }

        .debt-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          padding: 4px 16px 12px;
        }

        .debt-field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
        }

        .debt-field-row:nth-child(odd) { padding-right: 20px; border-right: 1px solid var(--border); }
        .debt-field-row:nth-child(even) { padding-left: 20px; }

        .debt-field-full {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 10px 0 0;
        }

        .debt-field-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .debt-text-input {
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: var(--navy);
          background: var(--cream);
          width: 140px;
          text-align: right;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .debt-text-input:focus { border-color: var(--navy); background: var(--white); }

        .debt-textarea {
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 13px;
          font-family: 'Inter', sans-serif;
          color: var(--navy);
          background: var(--cream);
          resize: vertical;
          outline: none;
          line-height: 1.5;
          min-height: 64px;
          width: 100%;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }

        .debt-textarea:focus { border-color: var(--navy); background: var(--white); }

        .raw-notes-block {
          margin: 0 24px 20px;
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
        }

        .raw-notes-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          background: rgba(27,43,75,0.02);
          border: none;
          padding: 9px 14px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: left;
        }

        .raw-notes-toggle:hover { background: rgba(27,43,75,0.05); }

        .raw-notes-text {
          padding: 12px 14px;
          font-size: 11px;
          font-family: 'ui-monospace', 'Menlo', 'Consolas', monospace;
          color: var(--text-muted);
          line-height: 1.65;
          white-space: pre-wrap;
          word-break: break-word;
          border-top: 1px solid var(--border);
          background: rgba(27,43,75,0.015);
        }

        @media (max-width: 640px) {
          .container { padding: 24px 16px 60px; }
          nav { padding: 0 16px; }
          .fields-grid { grid-template-columns: 1fr; }
          .field-row:nth-child(odd) { padding-right: 0; border-right: none; }
          .field-row:nth-child(even) { padding-left: 0; }
          .field-row:nth-last-child(-n+2) { border-bottom: 1px solid var(--border); }
          .field-row:last-child { border-bottom: none; }
          .year-card-header { flex-direction: column; align-items: flex-start; }
          .actions-bar { flex-direction: column-reverse; }
          .btn-secondary, .btn-primary { width: 100%; text-align: center; }
          .debt-fields { grid-template-columns: 1fr; }
          .debt-field-row:nth-child(odd) { padding-right: 0; border-right: none; }
          .debt-field-row:nth-child(even) { padding-left: 0; }
          .debt-text-input { width: 120px; }
        }
      `}</style>

      <nav>
        <div className="nav-left">
          <div className="logo"><img src={LOGO_BEIGE} alt="Junni" style={{ cursor: 'pointer' }} onClick={() => setLocation('/')} /></div>
          <span className="nav-back" onClick={() => setLocation(`/analysis/${dealId}`)}>{t("financialReview.backToAnalysis")}</span>
        </div>
        <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.8)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>⏻ Sign Out</button>
      </nav>

      <div className="container">
        <div className="page-header">
          <h1>Review Extracted Financials</h1>
          {deal?.title && <p className="deal-subtitle">{deal.title}</p>}
          <p className="page-instruction">
            {wasAlreadyConfirmed
              ? t("financialReview.instructionCorrection")
              : t("financialReview.instructionFirstTime")}
          </p>
        </div>

        {hasLowConfidence && (
          <div className="confidence-callout">
            ⚠ Some figures were flagged as lower confidence — please verify the highlighted values.
          </div>
        )}

        {financials.length === 0 ? (
          <div className="empty-state">No extracted financials found for this deal.</div>
        ) : (
          financials.map(row => {
            const isLowConf = row.extraction_confidence === "low";
            return (
              <div key={row.id} className={`year-card${isLowConf ? " low-confidence" : ""}`}>
                <div className="year-card-header">
                  <h2 className="fiscal-year">Fiscal Year {row.fiscal_year}</h2>
                  <div className="meta-labels">
                    {row.statement_type && (
                      <span className="meta-badge">{row.statement_type}</span>
                    )}
                    {row.preparing_firm && (
                      <span className="meta-badge">{row.preparing_firm}</span>
                    )}
                    {row.currency && (
                      <span className="meta-badge currency">{row.currency}</span>
                    )}
                    {row.extraction_confidence && (
                      <span className={`meta-badge conf-${row.extraction_confidence}`}>
                        {row.extraction_confidence} confidence
                      </span>
                    )}
                  </div>
                </div>

                <div className="fields-grid">
                  {NUMERIC_FIELDS.map(({ key, label }) => {
                    const val = edits[row.id]?.[key];
                    return (
                      <div key={key} className="field-row">
                        <label className="field-label">{label}</label>
                        <input
                          type="number"
                          className={`field-input${isLowConf ? " low-conf-input" : ""}`}
                          value={val ?? ""}
                          onChange={e => handleFieldChange(row.id, key, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="debt-section">
                  <div className="debt-section-header">
                    <span className="debt-section-title">{t("financialReview.debtDetailSection")}</span>
                    {row.debt_detail_confirmed
                      ? <span className="debt-status-confirmed">
                          {t("financialReview.debtStatusConfirmed").replace("{date}", new Date(row.debt_detail_confirmed_at).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" }))}
                        </span>
                      : <span className="debt-status-unreviewed">{t("financialReview.debtStatusUnreviewed")}</span>
                    }
                  </div>
                  <div className="debt-fields">
                    <div className="debt-field-row">
                      <label className="debt-field-label">{t("financialReview.debtLongTerm")}</label>
                      <input
                        type="number"
                        className="field-input"
                        value={debtEdits[row.id]?.long_term ?? ""}
                        onChange={e => handleDebtChange(row.id, "long_term", e.target.value)}
                        placeholder="—"
                      />
                    </div>
                    <div className="debt-field-row">
                      <label className="debt-field-label">{t("financialReview.debtCurrentPortion")}</label>
                      <input
                        type="number"
                        className="field-input"
                        value={debtEdits[row.id]?.current_portion ?? ""}
                        onChange={e => handleDebtChange(row.id, "current_portion", e.target.value)}
                        placeholder="—"
                      />
                    </div>
                    <div className="debt-field-row">
                      <label className="debt-field-label">{t("financialReview.debtRates")}</label>
                      <input
                        type="text"
                        className="debt-text-input"
                        value={debtEdits[row.id]?.rates ?? ""}
                        onChange={e => handleDebtChange(row.id, "rates", e.target.value)}
                        placeholder="—"
                      />
                    </div>
                    <div className="debt-field-row">
                      <label className="debt-field-label">{t("financialReview.debtMaturities")}</label>
                      <input
                        type="text"
                        className="debt-text-input"
                        value={debtEdits[row.id]?.maturities ?? ""}
                        onChange={e => handleDebtChange(row.id, "maturities", e.target.value)}
                        placeholder="—"
                      />
                    </div>
                    <div className="debt-field-full">
                      <label className="debt-field-label">{t("financialReview.debtDescription")}</label>
                      <textarea
                        className="debt-textarea"
                        value={debtEdits[row.id]?.description ?? ""}
                        onChange={e => handleDebtChange(row.id, "description", e.target.value)}
                        placeholder="—"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {row.notes_summary && (
                  <div className="notes-block">
                    <div className="notes-label">Notes from your statements (extracted)</div>
                    <div className="notes-text">{row.notes_summary}</div>
                  </div>
                )}

                {row.raw_notes && String(row.raw_notes).trim() && (
                  <div className="raw-notes-block">
                    <button
                      className="raw-notes-toggle"
                      onClick={() => setShowRawNotes(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                    >
                      {showRawNotes[row.id] ? `▲ ${t("financialReview.rawNotesHide")}` : `▼ ${t("financialReview.rawNotesShow")}`}
                    </button>
                    {showRawNotes[row.id] && (
                      <div className="raw-notes-text">{String(row.raw_notes).trim()}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        <div className="annotations-section">
          <h3>Additional Context &amp; Annotations</h3>

          {annotations.length > 0 && (
            <div className="annotations-list">
              {annotations.map(ann => (
                <div key={ann.id} className="annotation-item">
                  <div className="annotation-meta">
                    {ann.fiscal_year ? `FY${ann.fiscal_year}` : "General"} · {new Date(ann.created_at).toLocaleDateString("en-CA")}
                  </div>
                  <div className="annotation-note">{ann.note}</div>
                </div>
              ))}
            </div>
          )}

          <div className="add-annotation">
            <div className="add-annotation-row">
              <select
                className="year-select"
                value={newNoteYear}
                onChange={e => setNewNoteYear(e.target.value)}
              >
                <option value="general">General</option>
                {financials.map(f => (
                  <option key={f.id} value={String(f.fiscal_year)}>FY{f.fiscal_year}</option>
                ))}
              </select>
            </div>
            <textarea
              className="annotation-textarea"
              value={newNoteText}
              onChange={e => setNewNoteText(e.target.value)}
              placeholder="e.g. We also carry $400K in off-balance-sheet equipment lease obligations not shown above."
              rows={3}
            />
            <button
              className="btn-add-note"
              onClick={handleAddNote}
              disabled={addingNote || !newNoteText.trim()}
            >
              {addingNote ? "Adding..." : "Add Note"}
            </button>
          </div>
        </div>

        {rescoreError && (
          <div style={{ background: "#FFF5F5", border: "1px solid #FFCDD2", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#B71C1C" }}>
            {rescoreError}
          </div>
        )}
        <div className="actions-bar">
          <button className="btn-secondary" onClick={() => saveEdits(false)} disabled={isSaving || isRescoring}>
            {isSaving ? t("financialReview.saving") : "Save Draft"}
          </button>
          <button className="btn-primary" onClick={() => saveEdits(true)} disabled={isSaving || isRescoring}>
            {isRescoring
              ? t("financialReview.rescoring")
              : isSaving
              ? t("financialReview.saving")
              : t("financialReview.confirmRescore")}
          </button>
        </div>
      </div>
    </div>
  );
}
