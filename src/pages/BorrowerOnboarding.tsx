import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';
import { useLocation } from "wouter";

const LOGO_BEIGE = "/junni-logo-beige.png";

export default function BorrowerOnboarding() {
  const [, setLocation] = useLocation();
  const { user } = useAuth0();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1
    companyName: "Maple Ridge Manufacturing Inc.",
    industry: "Manufacturing",
    yearsOperating: "12",
    employees: "87",
    website: "https://mapleridge.ca",
    city: "Toronto",
    province: "Ontario, Canada",
    description: "Maple Ridge Manufacturing produces precision industrial components for the automotive and aerospace sectors across Ontario and Quebec. Founded in 2012, we serve 40+ OEM clients with ISO 9001-certified manufacturing processes.",
    // Step 2
    financialStatementFile: null,
    revenue2023: "14200000",
    ebitda2023: "2900000",
    revenue2024: "16800000",
    ebitda2024: "3600000",
    existingDebt: "820000",
    // Step 3
    businessLicense: null,
    taxId: null,
    bankStatement: null,
    // Step 4
    loanAmount: "3200000",
    loanTerm: "36 months (3.0 yr)",
    interestRate: "7.4",
    useOfFunds: "Equipment expansion ($1.9M), working capital ($800K), and partial debt refinancing ($500K) to support our 2025 growth plan.",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, [fieldName]: file.name }));
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const submitApplication = async () => {
    if (!user) {
      alert("Authentication error. Please log in again.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth0_id', user.sub)
        .single();

      if (userError || !userData) {
        alert("User profile not found. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const termMonths = parseInt(formData.loanTerm.split(' ')[0]) || 36;

      const { data: dealData, error: dealError } = await supabase.from('deals').insert({
        borrower_id: userData.id,
        title: formData.companyName + ' — ' + formData.industry + ' Financing',
        industry: formData.industry,
        amount_requested: parseFloat(formData.loanAmount) || 0,
        term_months: termMonths,
        interest_rate: parseFloat(formData.interestRate) || null,
        status: 'pending',
        province: formData.province,
        city: formData.city,
        annual_revenue: parseFloat(formData.revenue2024) || null,
        ebitda: parseFloat(formData.ebitda2024) || null,
        years_in_business: parseInt(formData.yearsOperating) || null,
        ai_summary: formData.useOfFunds,
      }).select().single();

      if (dealError || !dealData) {
        console.error('Deal insert error:', dealError);
        alert("Error submitting application. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const newDealId = dealData.id;

      // Trigger AI scoring in the background — does not block the redirect
      fetch("https://sypqecydiqdpruarkrvy.supabase.co/functions/v1/score-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: newDealId }),
      }).catch(err => console.error("Scoring trigger failed:", err));

      setLocation("/borrower-dashboard");
    } catch (err) {
      console.error('Submission error:', err);
      alert("Unexpected error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const progressPercent = Math.max(20, Math.round(((currentStep - 1) / 4) * 100));

  return (
    <div className="borrower-onboarding">
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        :root {
          --cream: #FAF8F4;
          --navy: #1B2B4B;
          --gold: #D4940A;
          --gold-light: #F5C842;
          --white: #FFFFFF;
          --border: #E8E2D9;
          --text-muted: #7A7060;
          --text-secondary: #4A4035;
          --green: #059669;
          --red: #DC2626;
        }

        body {
          font-family: 'Inter', sans-serif;
          background: var(--cream);
          color: var(--navy);
          -webkit-font-smoothing: antialiased;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* NAV */
        .nav {
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 40px;
          background: rgba(250, 248, 244, 0.95);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .nav-logo img {
          height: 72px;
          width: auto;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 20px;
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
          font-size: 12px;
          font-weight: 600;
          padding: 4px 11px;
          border-radius: 100px;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          color: var(--text-muted);
        }

        .lang-pill button.active {
          background: var(--navy);
          color: #fff;
        }

        .nav-save {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* LAYOUT */
        .layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          flex: 1;
          min-height: calc(100vh - 62px);
        }

        /* SIDEBAR */
        .sidebar {
          background: #fff;
          border-right: 1px solid var(--border);
          padding: 32px 24px;
          position: sticky;
          top: 62px;
          height: calc(100vh - 62px);
          overflow-y: auto;
        }

        .sidebar-heading {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 20px;
        }

        .step-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 32px;
        }

        .step-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.12s;
        }

        .step-item.active {
          background: rgba(27, 43, 75, 0.05);
        }

        .step-item.done .step-dot {
          background: var(--green);
          border-color: var(--green);
        }

        .step-item.active .step-dot {
          background: var(--navy);
          border-color: var(--navy);
        }

        .step-dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid var(--border);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          font-weight: 700;
          font-size: 10px;
          color: var(--text-muted);
        }

        .step-item.done .step-dot {
          font-size: 9px;
        }

        .step-item.active .step-dot,
        .step-item.done .step-dot {
          color: #fff;
        }

        .step-text {
          flex: 1;
        }

        .step-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
        }

        .step-item:not(.done):not(.active) .step-title {
          color: var(--text-muted);
          font-weight: 500;
        }

        .step-sub {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 1px;
        }

        .step-connector {
          width: 2px;
          height: 16px;
          background: var(--border);
          margin-left: 24px;
          margin-top: 2px;
          margin-bottom: 2px;
          border-radius: 2px;
        }

        .step-connector.done {
          background: var(--green);
        }

        /* PROGRESS BAR */
        .progress-wrap {
          margin-bottom: 28px;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 6px;
        }

        .progress-track {
          height: 4px;
          background: rgba(27, 43, 75, 0.08);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--navy), #3D5A8A);
          border-radius: 4px;
          transition: width 0.4s ease;
        }

        /* AI BOX */
        .ai-box {
          background: rgba(27, 43, 75, 0.03);
          border: 1px solid rgba(27, 43, 75, 0.08);
          border-radius: 10px;
          padding: 14px;
        }

        .ai-box-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--navy);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ai-box p {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.55;
        }

        /* MAIN CONTENT */
        .main {
          padding: 40px 48px;
          max-width: 780px;
        }

        .step-content {
          display: none;
        }

        .step-content.active {
          display: block;
        }

        /* STEP HEADER */
        .step-header {
          margin-bottom: 32px;
        }

        .step-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 8px;
        }

        .step-header h1 {
          font-family: 'Fraunces', serif;
          font-size: 32px;
          font-weight: 800;
          color: var(--navy);
          letter-spacing: -0.8px;
          margin-bottom: 8px;
        }

        .step-header p {
          font-size: 15px;
          color: var(--text-muted);
          line-height: 1.6;
        }

        /* FORM */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          margin-bottom: 24px;
        }

        .form-grid.cols-1 {
          grid-template-columns: 1fr;
        }

        .form-grid.cols-3 {
          grid-template-columns: 1fr 1fr 1fr;
        }

        .form-full {
          grid-column: 1 / -1;
        }

        .field {
          display: flex;
          flex-direction: column;
        }

        label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          display: block;
          margin-bottom: 5px;
          letter-spacing: 0.01em;
        }

        .req {
          color: var(--gold);
        }

        input[type="text"],
        input[type="number"],
        input[type="email"],
        input[type="url"],
        input[type="file"],
        select,
        textarea {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: var(--navy);
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px 12px;
          width: 100%;
          outline: none;
          transition: border-color 0.12s;
          -webkit-appearance: none;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: var(--navy);
          box-shadow: 0 0 0 3px rgba(27, 43, 75, 0.06);
        }

        textarea {
          resize: vertical;
          min-height: 80px;
          font-family: 'Inter', sans-serif;
        }

        select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%237A7060' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 32px;
          cursor: pointer;
        }

        .field-hint {
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 5px;
          line-height: 1.4;
        }

        /* NAVIGATION BUTTONS */
        .nav-buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 36px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }

        .btn {
          border: none;
          padding: 11px 22px;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.12s;
        }

        .btn-back {
          background: none;
          border: 1px solid var(--border);
          color: var(--navy);
        }

        .btn-back:hover {
          background: rgba(27, 43, 75, 0.03);
        }

        .btn-next {
          background: var(--navy);
          color: #fff;
        }

        .btn-next:hover {
          opacity: 0.85;
        }

        .review-box {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .review-heading {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          margin-bottom: 14px;
        }

        .review-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .review-item {
          display: flex;
          flex-direction: column;
        }

        .review-label {
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 4px;
        }

        .review-value {
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
        }

        /* MOBILE PROGRESS BAR */
        .mobile-progress {
          display: none;
          background: #fff;
          border-bottom: 1px solid var(--border);
          padding: 16px 20px;
          margin-bottom: 20px;
        }

        .mobile-progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--navy);
        }

        .mobile-progress-track {
          height: 6px;
          background: rgba(27, 43, 75, 0.08);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .mobile-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--navy), #3D5A8A);
          border-radius: 3px;
          transition: width 0.4s ease;
        }

        .mobile-step-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--navy);
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .mobile-progress {
            display: block;
          }

          .main {
            padding: 0 20px 40px 20px;
          }
        }
      `}</style>

      {/* Mobile Progress Bar */}
      <div className="mobile-progress">
        <div className="mobile-progress-header">
          <span>Step {currentStep} of 5</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mobile-progress-track">
          <div className="mobile-progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className="mobile-step-name">
          {[
            "Business Profile",
            "Financial Data & Documents",
            "KYC Verification",
            "Loan Request",
            "Review & Submit",
          ][currentStep - 1]}
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav">
        <div className="nav-logo">
          <img src={LOGO_BEIGE} alt="Junni" style={{ width: "120px", height: "auto" }} />
        </div>
        <div className="nav-right">
          <div className="lang-pill">
            <button className="active">EN</button>
            <button>FR</button>
          </div>
          <span className="nav-save">Progress saved automatically</span>
        </div>
      </nav>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-heading">Application Steps</div>

          <div className="progress-wrap">
            <div className="progress-label">
              <span>Step {currentStep} of 5</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>

          <div className="step-nav">
            {[
              { num: 1, title: "Business Profile", sub: "Company info & description" },
              { num: 2, title: "Financial Data & Documents", sub: "Financials & statement upload" },
              { num: 3, title: "KYC Verification", sub: "Identity & business docs" },
              { num: 4, title: "Loan Request", sub: "Amount, term & use of funds" },
              { num: 5, title: "Review & Submit", sub: "Final check before scoring" },
            ].map((step, idx) => (
              <div key={step.num}>
                <div
                  className={`step-item ${currentStep === step.num ? "active" : ""} ${currentStep > step.num ? "done" : ""}`}
                  onClick={() => goToStep(step.num)}
                >
                  <div className="step-dot">{currentStep > step.num ? "✓" : step.num}</div>
                  <div className="step-text">
                    <div className="step-title">{step.title}</div>
                    <div className="step-sub">{step.sub}</div>
                  </div>
                </div>
                {idx < 4 && <div className={`step-connector ${currentStep > step.num ? "done" : ""}`}></div>}
              </div>
            ))}
          </div>

          <div className="ai-box">
            <div className="ai-box-title">✦ AI Credit Scoring</div>
            <p>After submission, our engine analyzes your financials and generates a transparent credit score (1–10) with a full breakdown — typically in under 30 seconds.</p>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">
          {/* STEP 1 */}
          <div className={`step-content ${currentStep === 1 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 1 of 5</div>
              <h1>Business Profile</h1>
              <p>Tell us about your company. This information helps lenders understand your business and market position.</p>
            </div>
            <div className="form-grid">
              <div className="form-full field">
                <label>Company Name <span className="req">*</span></label>
                <input type="text" name="companyName" value={formData.companyName} onChange={handleInputChange} placeholder="Maple Ridge Manufacturing Inc." />
              </div>
              <div className="field">
                <label>Industry <span className="req">*</span></label>
                <select name="industry" value={formData.industry} onChange={handleInputChange}>
                  <option>Select industry</option>
                  <option>Technology</option>
                  <option>Healthcare</option>
                  <option>Manufacturing</option>
                  <option>Retail</option>
                  <option>Real Estate</option>
                  <option>Food & Beverage</option>
                  <option>Logistics & Transportation</option>
                  <option>Financial Services</option>
                  <option>Education</option>
                  <option>Energy</option>
                  <option>Construction</option>
                  <option>Media & Entertainment</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label>Years Operating <span className="req">*</span></label>
                <input type="number" name="yearsOperating" value={formData.yearsOperating} onChange={handleInputChange} min="0" placeholder="12" />
              </div>
              <div className="field">
                <label>Number of Employees</label>
                <input type="number" name="employees" value={formData.employees} onChange={handleInputChange} min="1" placeholder="87" />
              </div>
              <div className="field">
                <label>Website</label>
                <input type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://mapleridge.ca" />
              </div>
              <div className="field">
                <label>City</label>
                <input type="text" name="city" value={formData.city} onChange={handleInputChange} placeholder="Toronto" />
              </div>
              <div className="field">
                <label>Province / Country</label>
                <input type="text" name="province" value={formData.province} onChange={handleInputChange} placeholder="Ontario, Canada" />
              </div>
              <div className="form-full field">
                <label>Business Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} placeholder="Brief description of your business..."></textarea>
                <div className="field-hint">2–4 sentences. This will appear in your deal listing on the marketplace.</div>
              </div>
            </div>
            <div className="nav-buttons">
              <button className="btn btn-back">← Cancel</button>
              <button className="btn btn-next" onClick={() => goToStep(2)}>Continue →</button>
            </div>
          </div>

          {/* STEP 2 */}
          <div className={`step-content ${currentStep === 2 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 2 of 5</div>
              <h1>Financial Data & Documents</h1>
              <p>Upload your financial statements for AI credit analysis, then confirm or enter key figures below.</p>
            </div>

            <div className="form-grid cols-1">
              <div className="field">
                <label>Upload Financial Statements <span style={{ color: "var(--green)", fontSize: "11px", fontWeight: 500 }}>(Recommended)</span></label>
                <input type="file" accept=".pdf,.xlsx,.xls" onChange={(e) => handleFileChange(e, "financialStatementFile")} />
                <div className="field-hint">Upload your financial statements and we'll use them for AI credit analysis. You can also enter figures manually below.</div>
                {formData.financialStatementFile && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--green)", fontWeight: 600 }}>✓ {formData.financialStatementFile}</div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0 22px" }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>or enter figures manually</span>
              <div style={{ flex: 1, height: "1px", background: "var(--border)" }}></div>
            </div>

            <div className="form-grid cols-1">
              <div className="field">
                <label>Revenue 2023 (CAD) <span className="req">*</span></label>
                <input type="number" name="revenue2023" value={formData.revenue2023} onChange={handleInputChange} placeholder="14200000" />
              </div>
              <div className="field">
                <label>EBITDA 2023 (CAD) <span className="req">*</span></label>
                <input type="number" name="ebitda2023" value={formData.ebitda2023} onChange={handleInputChange} placeholder="2900000" />
              </div>
              <div className="field">
                <label>Revenue 2024 (CAD) <span className="req">*</span></label>
                <input type="number" name="revenue2024" value={formData.revenue2024} onChange={handleInputChange} placeholder="16800000" />
              </div>
              <div className="field">
                <label>EBITDA 2024 (CAD) <span className="req">*</span></label>
                <input type="number" name="ebitda2024" value={formData.ebitda2024} onChange={handleInputChange} placeholder="3600000" />
              </div>
              <div className="field">
                <label>Existing Debt Outstanding (CAD) <span className="req">*</span></label>
                <input type="number" name="existingDebt" value={formData.existingDebt} onChange={handleInputChange} placeholder="820000" />
                <div className="field-hint">Total of all current loans, credit lines, and debt obligations.</div>
              </div>
            </div>

            <div className="nav-buttons">
              <button className="btn btn-back" onClick={() => goToStep(1)}>← Back</button>
              <button className="btn btn-next" onClick={() => goToStep(3)}>Continue →</button>
            </div>
          </div>

          {/* STEP 3 */}
          <div className={`step-content ${currentStep === 3 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 3 of 5</div>
              <h1>KYC Verification</h1>
              <p>Upload identity and business verification documents. Required before your deal goes live on the marketplace.</p>
            </div>
            <div className="form-grid cols-1">
              <div className="field">
                <label>Business License <span className="req">*</span></label>
                <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, "businessLicense")} />
                <div className="field-hint">Provincial or federal business registration certificate</div>
              </div>
              <div className="field">
                <label>Tax ID / CRA Number <span className="req">*</span></label>
                <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, "taxId")} />
                <div className="field-hint">Business Number (BN) or CRA registration document</div>
              </div>
              <div className="field">
                <label>Bank Statement <span className="req">*</span></label>
                <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, "bankStatement")} />
                <div className="field-hint">Most recent 3 months of business banking statements</div>
              </div>
            </div>
            <div className="nav-buttons">
              <button className="btn btn-back" onClick={() => goToStep(2)}>← Back</button>
              <button className="btn btn-next" onClick={() => goToStep(4)}>Continue →</button>
            </div>
          </div>

          {/* STEP 4 */}
          <div className={`step-content ${currentStep === 4 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 4 of 5</div>
              <h1>Loan Request</h1>
              <p>Define the terms of your financing. Lenders will see these details and submit competitive bids.</p>
            </div>
            <div className="form-grid cols-1">
              <div className="field">
                <label>Requested Amount (CAD) <span className="req">*</span></label>
                <input type="number" name="loanAmount" value={formData.loanAmount} onChange={handleInputChange} placeholder="3200000" />
                <div className="field-hint">Minimum $500,000 · Maximum $20,000,000+</div>
              </div>
              <div className="field">
                <label>Loan Term <span className="req">*</span></label>
                <select name="loanTerm" value={formData.loanTerm} onChange={handleInputChange}>
                  <option>12 months (1.0 yr)</option>
                  <option>18 months (1.5 yr)</option>
                  <option>24 months (2.0 yr)</option>
                  <option>36 months (3.0 yr)</option>
                  <option>48 months (4.0 yr)</option>
                  <option>60 months (5.0 yr)</option>
                </select>
              </div>
              <div className="field">
                <label>Target Interest Rate (% p.a.)</label>
                <input type="number" name="interestRate" value={formData.interestRate} onChange={handleInputChange} step="0.1" placeholder="7.5" />
                <div className="field-hint">Leave blank to accept market rate from lenders.</div>
              </div>
              <div className="field">
                <label>Use of Funds <span className="req">*</span></label>
                <textarea name="useOfFunds" value={formData.useOfFunds} onChange={handleInputChange} rows={3} placeholder="Describe how you plan to use the financing..."></textarea>
              </div>
            </div>
            <div className="nav-buttons">
              <button className="btn btn-back" onClick={() => goToStep(3)}>← Back</button>
              <button className="btn btn-next" onClick={() => goToStep(5)}>Review Application →</button>
            </div>
          </div>

          {/* STEP 5 */}
          <div className={`step-content ${currentStep === 5 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 5 of 5</div>
              <h1>Review & Submit</h1>
              <p>Review your application before submitting for AI credit scoring.</p>
            </div>
            <div className="review-box">
              <div className="review-heading">Business Profile</div>
              <div className="review-grid">
                <div className="review-item">
                  <div className="review-label">Company</div>
                  <div className="review-value">{formData.companyName}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Industry</div>
                  <div className="review-value">{formData.industry}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Years Operating</div>
                  <div className="review-value">{formData.yearsOperating} years</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Location</div>
                  <div className="review-value">{formData.city}, {formData.province}</div>
                </div>
              </div>
            </div>
            <div className="review-box">
              <div className="review-heading">Loan Request</div>
              <div className="review-grid">
                <div className="review-item">
                  <div className="review-label">Amount</div>
                  <div className="review-value">${parseInt(formData.loanAmount).toLocaleString()}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Term</div>
                  <div className="review-value">{formData.loanTerm}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Rate Target</div>
                  <div className="review-value">{formData.interestRate}% p.a.</div>
                </div>
              </div>
            </div>
            <div className="nav-buttons">
              <button className="btn btn-back" onClick={() => goToStep(4)}>← Back</button>
              <button className="btn btn-next" style={{ background: "var(--gold)", color: "#fff" }} onClick={submitApplication} disabled={isSubmitting}>{isSubmitting ? "Submitting..." : "✦ Submit Application"}</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
