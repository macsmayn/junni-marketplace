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

const FIELDS: { key: string; label: string }[] = [
  { key: "revenue",                   label: "Revenue" },
  { key: "cogs",                      label: "Cost of Goods Sold" },
  { key: "gross_profit",              label: "Gross Profit" },
  { key: "operating_expenses",        label: "Operating Expenses" },
  { key: "ebitda",                    label: "EBITDA" },
  { key: "net_income",                label: "Net Income" },
  { key: "total_assets",              label: "Total Assets" },
  { key: "current_assets",            label: "Current Assets" },
  { key: "total_liabilities",         label: "Total Liabilities" },
  { key: "current_liabilities",       label: "Current Liabilities" },
  { key: "total_debt",                label: "Total Debt" },
  { key: "equity",                    label: "Equity" },
  { key: "interest_expense",          label: "Interest Expense" },
  { key: "cash",                      label: "Cash & Equivalents" },
  { key: "inventory",                 label: "Inventory" },
  { key: "accounts_receivable",       label: "Accounts Receivable" },
  { key: "accounts_payable",          label: "Accounts Payable" },
  { key: "capex",                     label: "Capital Expenditures (CapEx)" },
  { key: "cfo",                       label: "Cash Flow from Operations" },
  { key: "depreciation_amortization", label: "Depreciation & Amortization" },
];

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

  // Step 3
  const [finRows, setFinRows] = useState<FinRow[]>([]);
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

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
      body: { deal_id: dealId },
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

    const { error: dealUpdateErr } = await supabase
      .from("deals")
      .update({ financials_status: "confirmed" })
      .eq("id", dealId);
    if (dealUpdateErr) {
      setConfirmError(`Failed to confirm deal: ${dealUpdateErr.message}`);
      setConfirming(false);
      return;
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

              <div>
                <label style={labelStyle}>City</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Toronto"
                  value={city}
                  onChange={e => setCity(e.target.value)}
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

            {finRows.map((row, rowIdx) => {
              const isLastRow = (fIdx: number) =>
                isMobile ? fIdx === FIELDS.length - 1 : fIdx >= FIELDS.length - 2;

              return (
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
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                  }}>
                    {FIELDS.map(({ key, label }, fIdx) => (
                      <div key={key} style={{
                        padding: "14px 18px",
                        borderBottom: isLastRow(fIdx) ? "none" : `1px solid ${BORDER}`,
                        borderRight: !isMobile && fIdx % 2 === 0 ? `1px solid ${BORDER}` : "none",
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
                    ))}
                  </div>
                </div>
              );
            })}

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
