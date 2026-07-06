import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from "../lib/supabase";

const NAVY = "#1B2B4B";
const GOLD = "#D4940A";
const CREAM = "#FAF8F4";
const RED = "#DC2626";
const MUTED = "#7A7060";
const BORDER = "#E8E2D9";

const INDUSTRIES = [
  "Agriculture & Agri-Food", "Construction", "Education", "Energy",
  "Financial Services", "Food & Beverage", "Government & Public Sector",
  "Healthcare & Life Sciences", "Hospitality & Lodging", "Insurance",
  "Manufacturing", "Media & Entertainment", "Mining & Metals", "Other",
  "Professional Services", "Real Estate", "Retail & Consumer",
  "Special Purpose Vehicles", "Technology & Telecommunications",
  "Transportation & Logistics", "Wholesale & Distribution",
];

const FIELD_GROUPS: { label: string; fields: { key: string; label: string }[] }[] = [
  {
    label: "Income Statement",
    fields: [
      { key: "revenue",                   label: "Revenue" },
      { key: "cogs",                      label: "Cost of Goods Sold" },
      { key: "gross_profit",              label: "Gross Profit" },
      { key: "operating_expenses",        label: "Operating Expenses" },
      { key: "depreciation_amortization", label: "Depreciation & Amortization" },
      { key: "ebitda",                    label: "EBITDA" },
      { key: "interest_expense",          label: "Interest Expense" },
      { key: "net_income",                label: "Net Income" },
    ],
  },
  {
    label: "Balance Sheet",
    fields: [
      { key: "cash",                label: "Cash & Equivalents" },
      { key: "accounts_receivable", label: "Accounts Receivable" },
      { key: "inventory",           label: "Inventory" },
      { key: "current_assets",      label: "Current Assets" },
      { key: "total_assets",        label: "Total Assets" },
      { key: "accounts_payable",    label: "Accounts Payable" },
      { key: "current_liabilities", label: "Current Liabilities" },
      { key: "total_debt",          label: "Total Debt" },
      { key: "total_liabilities",   label: "Total Liabilities" },
      { key: "equity",              label: "Equity" },
    ],
  },
  {
    label: "Cash Flow Statement",
    fields: [
      { key: "cfo",   label: "Cash Flow from Operations" },
      { key: "capex", label: "Capital Expenditures (CapEx)" },
    ],
  },
];

const FIELDS = FIELD_GROUPS.flatMap(g => g.fields);

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return Number(v).toLocaleString("en-CA", { maximumFractionDigits: 0 });
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/[,$\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

interface FinRow {
  id: string | null;
  fiscal_year: number;
  [key: string]: any;
}

interface CapRow {
  holder_name: string;
  role: string;
  security_type: string;
  ownership_pct: string;
  notes: string;
}

interface CollRow {
  asset_type: string;
  description: string;
  market_value: string;
  advance_rate: string;
}

const COLLATERAL_DEFAULTS: Record<string, number> = {
  "Accounts Receivable": 75,
  "Inventory": 50,
  "Equipment & Machinery": 60,
  "Real Estate": 70,
  "Cash & Securities": 90,
  "Other": 25,
};

export default function NewAnalysis() {
  const { user } = useAuth0();
  const [, setLocation] = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [amountRequested, setAmountRequested] = useState("");
  const [termMonths, setTermMonths] = useState("60");
  const [interestRate, setInterestRate] = useState("10");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const [step1Loading, setStep1Loading] = useState(false);

  // After step 1
  const [dealId, setDealId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Step 2
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [noFinancials, setNoFinancials] = useState(false);

  // Step 1 — additional optional fields
  const [existingDebt, setExistingDebt] = useState("");
  const [useOfFunds, setUseOfFunds] = useState("");

  // Step 3
  const [finRows, setFinRows] = useState<FinRow[]>([]);
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  // Step 3 — cap table
  const [capOpen, setCapOpen] = useState(false);
  const [capRows, setCapRows] = useState<CapRow[]>([]);
  const [capDraft, setCapDraft] = useState<CapRow>({ holder_name: "", role: "Founder", security_type: "Common", ownership_pct: "", notes: "" });

  // Step 3 — collateral
  const [collOpen, setCollOpen] = useState(false);
  const [collRows, setCollRows] = useState<CollRow[]>([]);
  const [collDraft, setCollDraft] = useState<CollRow>({ asset_type: "Accounts Receivable", description: "", market_value: "", advance_rate: "75" });

  // ── Step 1 ──────────────────────────────────────────────────────────
  async function handleStep1() {
    setStep1Error("");
    if (!companyName.trim()) { setStep1Error("Company name is required."); return; }
    if (!industry) { setStep1Error("Industry is required."); return; }
    const amount = parseNum(amountRequested);
    if (!amount || amount <= 0) { setStep1Error("A valid loan amount is required."); return; }

    setStep1Loading(true);
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("auth0_id", user?.sub ?? "")
      .maybeSingle();

    if (userErr || !userData) {
      setStep1Error(userErr ? `Account lookup failed: ${userErr.message}` : "Could not find your account. Please try again.");
      setStep1Loading(false);
      return;
    }

    const { data: dealData, error: dealErr } = await supabase
      .from("deals")
      .insert({
        borrower_id: userData.id,
        title: companyName.trim(),
        industry,
        amount_requested: amount,
        term_months: parseInt(termMonths) || 60,
        interest_rate: parseFloat(interestRate) || 10,
        status: "pending",
        deal_source: "lender_analysis",
        ...(province.trim() ? { province: province.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(yearsInBusiness.trim() ? { years_in_business: parseInt(yearsInBusiness) } : {}),
        ...(existingDebt.trim() ? { existing_debt: parseNum(existingDebt) } : {}),
        ...(useOfFunds.trim() ? { use_of_funds: useOfFunds.trim() } : {}),
      })
      .select("id")
      .single();

    if (dealErr || !dealData) {
      setStep1Error(dealErr ? `Failed to create analysis: ${dealErr.message}` : "Failed to create analysis. Please try again.");
      setStep1Loading(false);
      return;
    }

    setUserId(userData.id);
    setDealId(dealData.id);
    setStep1Loading(false);
    setStep(2);
  }

  // ── Step 2: file handling ───────────────────────────────────────────
  function processFiles(fileList: FileList | null) {
    if (!fileList) return;
    const selected = Array.from(fileList);
    const allowed = ["pdf", "xlsx", "xls"];
    const rejected = selected.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return !allowed.includes(ext);
    });
    if (rejected.length > 0) {
      setFileError(`PDF or Excel — Word not supported. Remove: ${rejected.map(f => f.name).join(", ")}`);
      return;
    }
    setFileError("");
    setFiles(prev => [...prev, ...selected]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(e.target.files);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Step 2: extract ─────────────────────────────────────────────────
  async function handleExtract() {
    if (files.length === 0) { setFileError("Upload at least one file."); return; }
    if (!dealId || !userId) return;
    setFileError("");
    setNoFinancials(false);
    setExtracting(true);

    for (const file of files) {
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setFileError(`Upload failed for ${file.name}: ${upErr.message}`);
        setExtracting(false);
        return;
      }
      const { error: docErr } = await supabase.from("documents").insert({
        deal_id: dealId,
        uploaded_by: userId,
        file_name: file.name,
        file_type: file.type,
        size_bytes: file.size,
        storage_path: path,
        doc_category: "Financial Statement",
      });
      if (docErr) {
        setFileError(`Failed to record document ${file.name}: ${docErr.message}`);
        setExtracting(false);
        return;
      }
    }

    const { error: invokeErr } = await supabase.functions.invoke("score-deal", {
      body: { deal_id: dealId, extract_only: true },
    });
    if (invokeErr) {
      setFileError(`Extraction failed: ${invokeErr.message}`);
      setExtracting(false);
      return;
    }

    const { data: rows, error: rowsErr } = await supabase
      .from("extracted_financials")
      .select("*")
      .eq("deal_id", dealId)
      .order("fiscal_year", { ascending: false });

    setExtracting(false);

    if (rowsErr) {
      setFileError(`Failed to load extracted data: ${rowsErr.message}`);
      return;
    }

    if (rows && rows.length > 0) {
      initStep3(rows);
    } else {
      setNoFinancials(true);
    }
  }

  function handleManualEntry() {
    initStep3([{ id: null, fiscal_year: new Date().getFullYear() - 1 }]);
  }

  // ── Step 3 ──────────────────────────────────────────────────────────
  function initStep3(rows: any[]) {
    const fr: FinRow[] = rows.map(r => ({ id: r.id ?? null, fiscal_year: r.fiscal_year, ...r }));
    setFinRows(fr);
    const initEdits: Record<number, Record<string, string>> = {};
    fr.forEach((r, i) => {
      initEdits[i] = {};
      FIELDS.forEach(({ key }) => { initEdits[i][key] = fmtNum(r[key]); });
    });
    setEdits(initEdits);
    setStep(3);
  }

  function setEdit(rowIdx: number, key: string, val: string) {
    setEdits(prev => ({ ...prev, [rowIdx]: { ...prev[rowIdx], [key]: val } }));
  }

  async function handleConfirm() {
    if (!dealId) return;
    setConfirmError("");
    setConfirming(true);

    for (let i = 0; i < finRows.length; i++) {
      const row = finRows[i];
      const rowEdits = edits[i] || {};
      const values: Record<string, number | null> = {};
      FIELDS.forEach(({ key }) => {
        values[key] = parseNum(rowEdits[key] ?? fmtNum(row[key]));
      });

      if (row.id) {
        const { error } = await supabase
          .from("extracted_financials")
          .update({ ...values, borrower_confirmed: true })
          .eq("id", row.id);
        if (error) { setConfirmError(`Failed to save FY${row.fiscal_year}: ${error.message}`); setConfirming(false); return; }
      } else {
        const { error } = await supabase
          .from("extracted_financials")
          .insert({ deal_id: dealId, fiscal_year: row.fiscal_year, ...values, borrower_confirmed: true });
        if (error) { setConfirmError(`Failed to save FY${row.fiscal_year}: ${error.message}`); setConfirming(false); return; }
      }
    }

    const mrEdits = edits[0] || {};
    const mrRow = finRows[0];
    const snapshotRevenue = parseNum(mrEdits["revenue"] ?? fmtNum(mrRow?.revenue));
    const snapshotEbitda = parseNum(mrEdits["ebitda"] ?? fmtNum(mrRow?.ebitda));

    const { error: dealUpdateErr } = await supabase
      .from("deals")
      .update({
        financials_status: "confirmed",
        ...(snapshotRevenue !== null ? { annual_revenue: snapshotRevenue } : {}),
        ...(snapshotEbitda !== null ? { ebitda: snapshotEbitda } : {}),
      })
      .eq("id", dealId);
    if (dealUpdateErr) {
      setConfirmError(`Failed to confirm deal: ${dealUpdateErr.message}`);
      setConfirming(false);
      return;
    }

    // Cap table: delete then re-insert
    const { error: capDelErr } = await supabase.from("cap_table_entries").delete().eq("deal_id", dealId);
    if (capDelErr) { setConfirmError(`Failed to save cap table: ${capDelErr.message}`); setConfirming(false); return; }
    const capInsert = capRows.filter(r => r.holder_name.trim()).map(r => ({
      deal_id: dealId,
      holder_name: r.holder_name.trim(),
      role: r.role,
      security_type: r.security_type,
      ownership_pct: parseNum(r.ownership_pct),
      notes: r.notes.trim() || null,
    }));
    if (capInsert.length > 0) {
      const { error: capInsErr } = await supabase.from("cap_table_entries").insert(capInsert);
      if (capInsErr) { setConfirmError(`Failed to insert cap table: ${capInsErr.message}`); setConfirming(false); return; }
    }

    // Collateral: delete then re-insert
    const { error: collDelErr } = await supabase.from("collateral_assets").delete().eq("deal_id", dealId);
    if (collDelErr) { setConfirmError(`Failed to save collateral: ${collDelErr.message}`); setConfirming(false); return; }
    const collInsert = collRows.filter(r => r.market_value.trim()).map(r => {
      const mv = parseNum(r.market_value) ?? 0;
      const ar = parseFloat(r.advance_rate) || 0;
      return {
        deal_id: dealId,
        asset_type: r.asset_type,
        description: r.description.trim() || null,
        market_value: mv,
        advance_rate: ar,
        lending_value: mv * ar / 100,
      };
    });
    if (collInsert.length > 0) {
      const { error: collInsErr } = await supabase.from("collateral_assets").insert(collInsert);
      if (collInsErr) { setConfirmError(`Failed to insert collateral: ${collInsErr.message}`); setConfirming(false); return; }
    }

    const { error: scoreErr } = await supabase.functions.invoke("score-deal", {
      body: { deal_id: dealId },
    });
    if (scoreErr) {
      setConfirmError(`Scoring failed: ${scoreErr.message}`);
      setConfirming(false);
      return;
    }

    setLocation(`/analysis/${dealId}`);
  }

  function addCapRow() {
    if (!capDraft.holder_name.trim()) return;
    setCapRows(prev => [...prev, { ...capDraft }]);
    setCapDraft({ holder_name: "", role: "Founder", security_type: "Common", ownership_pct: "", notes: "" });
  }

  function addCollRow() {
    if (!collDraft.market_value.trim()) return;
    setCollRows(prev => [...prev, { ...collDraft }]);
    setCollDraft({ asset_type: "Accounts Receivable", description: "", market_value: "", advance_rate: "75" });
  }

  // ── Styles ───────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px",
    border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 14,
    fontFamily: "Inter, sans-serif", color: NAVY, background: "#fff", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600, color: MUTED,
    letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6,
  };

  const btnGold: React.CSSProperties = {
    background: GOLD, color: "#fff", border: "none", borderRadius: 8,
    padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  };

  const btnNavy: React.CSSProperties = {
    background: NAVY, color: "#fff", border: "none", borderRadius: 8,
    padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  };

  const btnGhost: React.CSSProperties = {
    background: "transparent", color: NAVY, border: `1px solid ${BORDER}`,
    borderRadius: 8, padding: "12px 28px", fontSize: 14, fontWeight: 500,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
  };

  const STEP_LABELS = ["Company & Terms", "Documents", "Review & Score"];

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: "Inter, sans-serif", color: NAVY }}>

      {/* NAV */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "14px 20px" : "16px 40px",
        background: NAVY, color: "#fff",
      }}>
        <span
          style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: 20, cursor: "pointer" }}
          onClick={() => setLocation("/lender-dashboard")}
        >
          Junni
        </span>
        <span style={{ fontSize: 13, opacity: 0.65 }}>New Analysis</span>
      </div>

      {/* STEP INDICATOR */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: isMobile ? "24px 20px 4px" : "32px 40px 4px",
      }}>
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={n} style={{ display: "flex", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: isMobile ? 40 : 80 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: done ? GOLD : active ? NAVY : "#E8E2D9",
                  color: done || active ? "#fff" : MUTED,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                }}>
                  {done ? "✓" : n}
                </div>
                {!isMobile && (
                  <span style={{
                    fontSize: 11, fontWeight: active ? 600 : 400,
                    color: active ? NAVY : MUTED, textAlign: "center",
                    whiteSpace: "nowrap",
                  }}>
                    {label}
                  </span>
                )}
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div style={{
                  width: isMobile ? 28 : 60, height: 1,
                  background: done ? GOLD : BORDER,
                  margin: isMobile ? "15px 6px 0" : "15px 10px 0",
                  flexShrink: 0,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* PAGE CONTENT */}
      <div style={{ maxWidth: 660, margin: "0 auto", padding: isMobile ? "24px 20px 80px" : "36px 40px 80px" }}>

        {/* ═══ STEP 1: Company & Terms ═══ */}
        {step === 1 && (
          <div>
            <h2 style={{
              fontFamily: "Fraunces, serif", fontWeight: 800,
              fontSize: isMobile ? 24 : 30, margin: "0 0 8px", color: NAVY,
            }}>
              Company & Terms
            </h2>
            <p style={{ margin: "0 0 32px", color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
              Enter the borrower's company details and the proposed loan terms for this analysis.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={labelStyle}>Company Name *</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Acme Manufacturing Inc."
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>Industry *</label>
                <select style={inputStyle} value={industry} onChange={e => setIndustry(e.target.value)}>
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Amount Requested (CAD) *</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. 2,500,000"
                    value={amountRequested}
                    onChange={e => setAmountRequested(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Term (months)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={termMonths}
                    onChange={e => setTermMonths(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Interest Rate (%)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Province</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Ontario"
                    value={province}
                    onChange={e => setProvince(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input
                    style={inputStyle}
                    placeholder="e.g. Toronto"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Years in Business</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    placeholder="e.g. 12"
                    value={yearsInBusiness}
                    onChange={e => setYearsInBusiness(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Existing Debt ($)</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. 500,000"
                  value={existingDebt}
                  onChange={e => setExistingDebt(e.target.value)}
                />
              </div>

              <div>
                <label style={labelStyle}>Use of Funds</label>
                <textarea
                  style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                  rows={3}
                  placeholder="e.g. Equipment purchase, working capital, refinancing…"
                  value={useOfFunds}
                  onChange={e => setUseOfFunds(e.target.value)}
                />
              </div>
            </div>

            {step1Error && (
              <div style={{
                marginTop: 16, padding: "10px 14px",
                background: "#FEF2F2", border: `1px solid ${RED}30`,
                borderRadius: 8, color: RED, fontSize: 13,
              }}>
                {step1Error}
              </div>
            )}

            <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button style={btnGhost} onClick={() => setLocation("/lender-dashboard")}>Cancel</button>
              <button
                style={step1Loading ? { ...btnGold, opacity: 0.6, cursor: "not-allowed" } : btnGold}
                disabled={step1Loading}
                onClick={handleStep1}
              >
                {step1Loading ? "Creating…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Documents & Extraction ═══ */}
        {step === 2 && (
          <div>
            <h2 style={{
              fontFamily: "Fraunces, serif", fontWeight: 800,
              fontSize: isMobile ? 24 : 30, margin: "0 0 8px", color: NAVY,
            }}>
              Upload Financial Statements
            </h2>
            <p style={{ margin: "0 0 32px", color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
              Upload 2–3 years of financial statements. We'll extract the key figures automatically.
            </p>

            {/* Drop zone */}
            <div
              style={{
                border: `2px dashed ${BORDER}`, borderRadius: 12,
                padding: "36px 24px", textAlign: "center",
                background: "#fff", cursor: "pointer",
              }}
              onClick={() => !extracting && document.getElementById("na-file-input")?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); if (!extracting) processFiles(e.dataTransfer.files); }}
            >
              <input
                id="na-file-input"
                type="file"
                accept=".pdf,.xlsx,.xls"
                multiple
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
              <div style={{ fontSize: 28, marginBottom: 10 }}>📎</div>
              <div style={{ fontWeight: 600, color: NAVY, marginBottom: 4, fontSize: 14 }}>
                Click to upload or drag and drop
              </div>
              <div style={{ fontSize: 12, color: MUTED }}>
                PDF or Excel — Word not supported
              </div>
            </div>

            {fileError && (
              <div style={{
                marginTop: 10, padding: "8px 12px",
                background: "#FEF2F2", border: `1px solid ${RED}30`,
                borderRadius: 6, color: RED, fontSize: 13,
              }}>
                {fileError}
              </div>
            )}

            {/* File list */}
            {files.length > 0 && (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {files.map((f, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "#fff", borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 16 }}>📄</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: MUTED }}>{(f.size / 1024).toFixed(0)} KB</div>
                      </div>
                    </div>
                    {!extracting && (
                      <button
                        onClick={() => removeFile(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 20, padding: "0 4px", lineHeight: 1 }}
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Extracting spinner */}
            {extracting && (
              <div style={{
                marginTop: 24, padding: "20px 24px",
                background: "#EEF2FF", border: "1px solid #4F46E530",
                borderRadius: 10, textAlign: "center",
              }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>⏳</div>
                <div style={{ fontWeight: 600, color: NAVY, marginBottom: 4 }}>Extracting financials</div>
                <div style={{ fontSize: 13, color: MUTED }}>
                  This takes 30–90 seconds — please keep this page open.
                </div>
              </div>
            )}

            {/* No financials extracted */}
            {noFinancials && !extracting && (
              <div style={{
                marginTop: 24, padding: "20px 24px",
                background: "#FFF9EC", border: `1px solid ${GOLD}40`,
                borderRadius: 10,
              }}>
                <div style={{ fontWeight: 600, color: NAVY, marginBottom: 6 }}>
                  No financials could be extracted
                </div>
                <div style={{ fontSize: 13, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>
                  The documents may be scanned images or in an unsupported format. You can enter the figures manually instead.
                </div>
                <button style={btnNavy} onClick={handleManualEntry}>Enter manually →</button>
              </div>
            )}

            {!extracting && !noFinancials && (
              <div style={{ marginTop: 32, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button style={btnGhost} onClick={() => setStep(1)}>← Back</button>
                <button
                  style={files.length === 0 ? { ...btnGold, opacity: 0.5, cursor: "not-allowed" } : btnGold}
                  disabled={files.length === 0}
                  onClick={handleExtract}
                >
                  Extract financials →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 3: Review & Confirm ═══ */}
        {step === 3 && (
          <div>
            <h2 style={{
              fontFamily: "Fraunces, serif", fontWeight: 800,
              fontSize: isMobile ? 24 : 30, margin: "0 0 8px", color: NAVY,
            }}>
              Review & Confirm
            </h2>
            <p style={{ margin: "0 0 4px", color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
              Review the extracted figures and correct any errors before scoring.
            </p>
            <p style={{ margin: "0 0 28px", fontSize: 12, color: MUTED }}>
              All amounts in CAD. Leave a field blank if the figure does not apply.
            </p>

            {finRows.map((row, rowIdx) => (
              <div key={rowIdx} style={{
                background: "#fff", borderRadius: 12,
                border: `1px solid ${BORDER}`, marginBottom: 24,
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 20px", background: NAVY, color: "#fff",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: 16 }}>
                    FY{row.fiscal_year}
                  </span>
                  {rowIdx === 0 && (
                    <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.65 }}>Most recent</span>
                  )}
                </div>

                {FIELD_GROUPS.map((group) => {
                  const n = group.fields.length;
                  return (
                    <div key={group.label}>
                      <div style={{
                        padding: "9px 18px 5px",
                        borderTop: `1px solid ${BORDER}`,
                        fontSize: 10, fontWeight: 700,
                        fontVariant: "small-caps", letterSpacing: "0.07em",
                        textTransform: "uppercase", color: NAVY,
                      }}>
                        {group.label}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
                        {group.fields.map(({ key, label }, fIdx) => {
                          const isLast = fIdx === n - 1;
                          return (
                            <div key={key} style={{
                              padding: "12px 18px",
                              borderBottom: isLast ? "none" : `1px solid ${BORDER}`,
                            }}>
                              <label style={{ ...labelStyle, marginBottom: 5 }}>{label}</label>
                              <input
                                style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }}
                                type="text"
                                placeholder="—"
                                value={edits[rowIdx]?.[key] ?? ""}
                                onChange={e => setEdit(rowIdx, key, e.target.value)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ─── Capitalization Table (optional) ─── */}
            <div style={{ marginTop: 32 }}>
              <button
                type="button"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between", padding: "14px 18px",
                  background: "#fff", border: `1px solid ${BORDER}`,
                  borderRadius: capOpen ? "12px 12px 0 0" : 12,
                  cursor: "pointer", textAlign: "left",
                }}
                onClick={() => setCapOpen(o => !o)}
              >
                <span>
                  <span style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: 15, color: NAVY }}>Capitalization Table </span>
                  <span style={{ fontSize: 12, color: MUTED, fontFamily: "Inter, sans-serif" }}>(optional)</span>
                </span>
                <span style={{ color: MUTED, fontSize: 11, transform: capOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
              </button>
              {capOpen && (
                <div style={{ border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 12px 12px", background: "#fff" }}>
                  {capRows.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 120px 70px 2fr 32px", minWidth: 560, padding: "8px 18px", borderBottom: `1px solid ${BORDER}` }}>
                        {["Holder", "Role", "Security", "%", "Notes", ""].map((h, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, padding: "0 4px" }}>{h}</span>
                        ))}
                      </div>
                      {capRows.map((row, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 100px 120px 70px 2fr 32px", minWidth: 560, padding: "10px 18px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: NAVY, fontWeight: 500, padding: "0 4px" }}>{row.holder_name}</span>
                          <span style={{ fontSize: 13, color: MUTED, padding: "0 4px" }}>{row.role}</span>
                          <span style={{ fontSize: 13, color: MUTED, padding: "0 4px" }}>{row.security_type}</span>
                          <span style={{ fontSize: 13, color: NAVY, padding: "0 4px" }}>{row.ownership_pct ? `${row.ownership_pct}%` : "—"}</span>
                          <span style={{ fontSize: 12, color: MUTED, padding: "0 4px" }}>{row.notes || "—"}</span>
                          <button type="button" onClick={() => setCapRows(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1, alignSelf: "center" }}>×</button>
                        </div>
                      ))}
                      {(() => {
                        const total = capRows.reduce((s, r) => s + (parseFloat(r.ownership_pct) || 0), 0);
                        const over = total > 100;
                        return (
                          <div style={{ padding: "8px 18px", display: "flex", justifyContent: "flex-end", gap: 8, fontSize: 12, borderBottom: `1px solid ${BORDER}` }}>
                            <span style={{ color: MUTED }}>Total ownership:</span>
                            <span style={{ fontWeight: 700, color: over ? RED : NAVY }}>{total.toFixed(1)}%{over ? " — exceeds 100%" : ""}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Add holder</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Holder name</label>
                          <input style={inputStyle} placeholder="e.g. Jane Smith" value={capDraft.holder_name}
                            onChange={e => setCapDraft(p => ({ ...p, holder_name: e.target.value }))} />
                        </div>
                        <div>
                          <label style={labelStyle}>Ownership %</label>
                          <input style={inputStyle} type="number" min="0" max="100" step="0.1" placeholder="e.g. 40"
                            value={capDraft.ownership_pct}
                            onChange={e => setCapDraft(p => ({ ...p, ownership_pct: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Role</label>
                          <select style={inputStyle} value={capDraft.role}
                            onChange={e => setCapDraft(p => ({ ...p, role: e.target.value }))}>
                            {["Founder", "Investor", "Employee pool", "Other"].map(r => <option key={r}>{r}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Security type</label>
                          <select style={inputStyle} value={capDraft.security_type}
                            onChange={e => setCapDraft(p => ({ ...p, security_type: e.target.value }))}>
                            {["Common", "Preferred", "Options", "SAFE", "Convertible", "Debt", "Other"].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Notes</label>
                        <input style={inputStyle} placeholder="e.g. 4-year vest, 1-year cliff…"
                          value={capDraft.notes}
                          onChange={e => setCapDraft(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" style={{ ...btnNavy, padding: "8px 18px", fontSize: 13 }} onClick={addCapRow}>+ Add holder</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Collateral (optional) ─── */}
            <div style={{ marginTop: 16, marginBottom: 32 }}>
              <button
                type="button"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between", padding: "14px 18px",
                  background: "#fff", border: `1px solid ${BORDER}`,
                  borderRadius: collOpen ? "12px 12px 0 0" : 12,
                  cursor: "pointer", textAlign: "left",
                }}
                onClick={() => setCollOpen(o => !o)}
              >
                <span>
                  <span style={{ fontFamily: "Fraunces, serif", fontWeight: 800, fontSize: 15, color: NAVY }}>Collateral </span>
                  <span style={{ fontSize: 12, color: MUTED, fontFamily: "Inter, sans-serif" }}>(optional)</span>
                </span>
                <span style={{ color: MUTED, fontSize: 11, transform: collOpen ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>▼</span>
              </button>
              {collOpen && (
                <div style={{ border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 12px 12px", background: "#fff" }}>
                  {collRows.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "140px 2fr 120px 80px 120px 32px", minWidth: 580, padding: "8px 18px", borderBottom: `1px solid ${BORDER}` }}>
                        {["Asset", "Description", "Market Value", "Advance %", "Lending Value", ""].map((h, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: MUTED, padding: "0 4px" }}>{h}</span>
                        ))}
                      </div>
                      {collRows.map((row, i) => {
                        const mv = parseNum(row.market_value) ?? 0;
                        const ar = parseFloat(row.advance_rate) || 0;
                        const lv = mv * ar / 100;
                        return (
                          <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 2fr 120px 80px 120px 32px", minWidth: 580, padding: "10px 18px", borderBottom: `1px solid ${BORDER}`, alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: NAVY, fontWeight: 500, padding: "0 4px" }}>{row.asset_type}</span>
                            <span style={{ fontSize: 12, color: MUTED, padding: "0 4px" }}>{row.description || "—"}</span>
                            <span style={{ fontSize: 13, color: NAVY, padding: "0 4px" }}>${fmtNum(mv)}</span>
                            <span style={{ fontSize: 13, color: MUTED, padding: "0 4px" }}>{row.advance_rate}%</span>
                            <span style={{ fontSize: 13, color: NAVY, fontWeight: 500, padding: "0 4px" }}>${fmtNum(lv)}</span>
                            <button type="button" onClick={() => setCollRows(prev => prev.filter((_, j) => j !== i))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1, alignSelf: "center" }}>×</button>
                          </div>
                        );
                      })}
                      {(() => {
                        const sumMV = collRows.reduce((s, r) => s + (parseNum(r.market_value) ?? 0), 0);
                        const sumLV = collRows.reduce((s, r) => {
                          const mv = parseNum(r.market_value) ?? 0;
                          const ar = parseFloat(r.advance_rate) || 0;
                          return s + mv * ar / 100;
                        }, 0);
                        const totalDebt = (parseNum(existingDebt) ?? 0) + (parseNum(amountRequested) ?? 0);
                        const coverage = totalDebt > 0 ? sumLV / totalDebt : null;
                        return (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "140px 2fr 120px 80px 120px 32px", minWidth: 580, padding: "8px 18px", borderBottom: coverage !== null ? `1px solid ${BORDER}` : "none" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, padding: "0 4px", gridColumn: "1 / 3" }}>Total</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, padding: "0 4px" }}>${fmtNum(sumMV)}</span>
                              <span></span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, padding: "0 4px" }}>${fmtNum(sumLV)}</span>
                              <span></span>
                            </div>
                            {coverage !== null && (
                              <div style={{ padding: "10px 18px", fontSize: 12, color: MUTED }}>
                                Lending value ${fmtNum(sumLV)} ÷ total debt ${fmtNum(totalDebt)} (existing ${fmtNum(parseNum(existingDebt) ?? 0)} + requested ${fmtNum(parseNum(amountRequested) ?? 0)}) = <strong style={{ color: NAVY }}>{coverage.toFixed(2)}x</strong>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Add asset</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Asset type</label>
                          <select style={inputStyle} value={collDraft.asset_type}
                            onChange={e => {
                              const type = e.target.value;
                              setCollDraft(p => ({ ...p, asset_type: type, advance_rate: String(COLLATERAL_DEFAULTS[type] ?? 25) }));
                            }}>
                            {Object.keys(COLLATERAL_DEFAULTS).map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Description</label>
                          <input style={inputStyle} placeholder="e.g. 2021 CNC machine" value={collDraft.description}
                            onChange={e => setCollDraft(p => ({ ...p, description: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={labelStyle}>Market value ($)</label>
                          <input style={inputStyle} placeholder="e.g. 250,000" value={collDraft.market_value}
                            onChange={e => setCollDraft(p => ({ ...p, market_value: e.target.value }))} />
                        </div>
                        <div>
                          <label style={labelStyle}>Advance rate (%)</label>
                          <input style={inputStyle} type="number" min="0" max="100" step="1" value={collDraft.advance_rate}
                            onChange={e => setCollDraft(p => ({ ...p, advance_rate: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="button" style={{ ...btnNavy, padding: "8px 18px", fontSize: 13 }} onClick={addCollRow}>+ Add asset</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {confirmError && (
              <div style={{
                marginBottom: 16, padding: "10px 14px",
                background: "#FEF2F2", border: `1px solid ${RED}30`,
                borderRadius: 8, color: RED, fontSize: 13,
              }}>
                {confirmError}
              </div>
            )}

            {confirming && (
              <div style={{
                marginBottom: 20, padding: "14px 18px",
                background: "#EEF2FF", border: "1px solid #4F46E530",
                borderRadius: 10, textAlign: "center",
              }}>
                <div style={{ fontWeight: 600, color: NAVY, marginBottom: 4 }}>Scoring — about 30 seconds</div>
                <div style={{ fontSize: 13, color: MUTED }}>Please keep this page open.</div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                style={confirming ? { ...btnGhost, opacity: 0.5, cursor: "not-allowed" } : btnGhost}
                disabled={confirming}
                onClick={() => setStep(2)}
              >
                ← Back
              </button>
              <button
                style={confirming ? { ...btnGold, opacity: 0.6, cursor: "not-allowed" } : btnGold}
                disabled={confirming}
                onClick={handleConfirm}
              >
                {confirming ? "Scoring…" : "Confirm & Score →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
