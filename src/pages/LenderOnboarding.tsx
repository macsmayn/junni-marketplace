import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';
import { useLocation } from "wouter";

const LOGO_BEIGE = "/junni-logo-beige.png";

const INDUSTRIES = [
  "Technology", "Healthcare", "Manufacturing", "Retail",
  "Logistics", "Energy", "Construction", "Real Estate",
  "Food & Beverage", "Financial Services", "Other",
];

const PROVINCES = [
  "Ontario", "Quebec", "British Columbia", "Alberta",
  "Saskatchewan", "Manitoba", "Other",
];

export default function LenderOnboarding() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth0();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    title: "",
    company_name: "",
    phone: "",
    investor_type: "",
    min_deal_size: "",
    max_deal_size: "",
    preferred_industries: [] as string[],
    preferred_provinces: [] as string[],
    target_yield_min: "",
    target_yield_max: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (field: "preferred_industries" | "preferred_provinces", value: string) => {
    setFormData(prev => {
      const current = prev[field];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value],
      };
    });
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

      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          company_name: formData.company_name,
          phone: formData.phone,
        })
        .eq('auth0_id', user.sub);

      if (updateError) {
        console.error('User update error:', updateError);
        alert("Error saving profile. Please try again.");
        setIsSubmitting(false);
        return;
      }

      const { error: profileError } = await supabase.from('lender_profiles').upsert({
        user_id: userData.id,
        title: formData.title,
        company_name: formData.company_name,
        phone: formData.phone,
        investor_type: formData.investor_type,
        min_deal_size: parseFloat(formData.min_deal_size) || null,
        max_deal_size: parseFloat(formData.max_deal_size) || null,
        preferred_industries: formData.preferred_industries,
        preferred_provinces: formData.preferred_provinces,
        target_yield_min: parseFloat(formData.target_yield_min) || null,
        target_yield_max: parseFloat(formData.target_yield_max) || null,
      }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('Lender profile insert error:', profileError);
        alert("Error submitting profile. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setLocation("/lender-dashboard");
    } catch (err) {
      console.error('Submission error:', err);
      alert("Unexpected error. Please try again.");
      setIsSubmitting(false);
    }
  };

  const progressPercent = Math.round((currentStep / 3) * 100);

  return (
    <div className="lender-onboarding">
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
        input[type="tel"],
        select {
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
        select:focus {
          border-color: var(--navy);
          box-shadow: 0 0 0 3px rgba(27, 43, 75, 0.06);
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

        /* CHECKBOXES */
        .checkbox-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.12s;
          background: #fff;
          user-select: none;
        }

        .checkbox-item:hover {
          border-color: rgba(27, 43, 75, 0.3);
          background: rgba(27, 43, 75, 0.02);
        }

        .checkbox-item.checked {
          border-color: var(--navy);
          background: rgba(27, 43, 75, 0.05);
        }

        .checkbox-item input[type="checkbox"] {
          width: 15px;
          height: 15px;
          accent-color: var(--navy);
          cursor: pointer;
          flex-shrink: 0;
          margin: 0;
        }

        .checkbox-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--navy);
          cursor: pointer;
          line-height: 1.3;
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

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* REVIEW BOXES */
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

        .review-item.full {
          grid-column: 1 / -1;
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

        .review-value.empty {
          color: var(--text-muted);
          font-weight: 400;
          font-style: italic;
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

          .checkbox-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      {/* Mobile Progress Bar */}
      <div className="mobile-progress">
        <div className="mobile-progress-header">
          <span>Step {currentStep} of 3</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="mobile-progress-track">
          <div className="mobile-progress-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <div className="mobile-step-name">
          {["Profile", "Investment Mandate", "Review & Submit"][currentStep - 1]}
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav">
        <div className="nav-logo">
          <img src={LOGO_BEIGE} alt="Junni" style={{ width: "120px", height: "auto", cursor: 'pointer' }} onClick={() => setLocation('/')} />
        </div>
        <div className="nav-right">
          <div className="lang-pill">
            <button className="active">EN</button>
            <button>FR</button>
          </div>
          <span className="nav-save">Progress saved automatically</span>
          <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.8)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: 6 }}>⏻ Sign Out</button>
        </div>
      </nav>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sidebar-heading">Application Steps</div>

          <div className="progress-wrap">
            <div className="progress-label">
              <span>Step {currentStep} of 3</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>

          <div className="step-nav">
            {[
              { num: 1, title: "Profile", sub: "Personal & company info" },
              { num: 2, title: "Investment Mandate", sub: "Deal preferences & yield targets" },
              { num: 3, title: "Review & Submit", sub: "Final check before going live" },
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
                {idx < 2 && <div className={`step-connector ${currentStep > step.num ? "done" : ""}`}></div>}
              </div>
            ))}
          </div>

          <div className="ai-box">
            <div className="ai-box-title">✦ Smart Deal Matching</div>
            <p>After setup, our engine matches your mandate to live deals in real time — filtering by size, industry, province, and yield target automatically.</p>
          </div>
        </aside>

        {/* MAIN */}
        <main className="main">

          {/* STEP 1 — Profile */}
          <div className={`step-content ${currentStep === 1 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 1 of 3</div>
              <h1>Your Profile</h1>
              <p>Tell us who you are and what kind of investor you represent. This helps borrowers understand who is reviewing their deal.</p>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Full Name <span className="req">*</span></label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} placeholder="Jane Smith" />
              </div>
              <div className="field">
                <label>Title <span className="req">*</span></label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="Managing Director" />
              </div>
              <div className="field">
                <label>Company Name <span className="req">*</span></label>
                <input type="text" name="company_name" value={formData.company_name} onChange={handleInputChange} placeholder="Northgate Capital" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+1 416 555 0100" />
              </div>
              <div className="form-full field">
                <label>Investor Type <span className="req">*</span></label>
                <select name="investor_type" value={formData.investor_type} onChange={handleInputChange}>
                  <option value="">Select investor type</option>
                  <option>Family Office</option>
                  <option>Credit Union</option>
                  <option>Hedge Fund</option>
                  <option>Private Equity</option>
                  <option>Accredited Individual</option>
                  <option>Bank</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <div className="nav-buttons">
              <button className="btn btn-back">← Cancel</button>
              <button className="btn btn-next" onClick={() => goToStep(2)}>Continue →</button>
            </div>
          </div>

          {/* STEP 2 — Investment Mandate */}
          <div className={`step-content ${currentStep === 2 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 2 of 3</div>
              <h1>Investment Mandate</h1>
              <p>Define your deal preferences. We use these to surface the most relevant opportunities for you on the marketplace.</p>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Min Deal Size (CAD) <span className="req">*</span></label>
                <input type="number" name="min_deal_size" value={formData.min_deal_size} onChange={handleInputChange} placeholder="500000" min="0" />
              </div>
              <div className="field">
                <label>Max Deal Size (CAD) <span className="req">*</span></label>
                <input type="number" name="max_deal_size" value={formData.max_deal_size} onChange={handleInputChange} placeholder="5000000" min="0" />
              </div>
              <div className="field">
                <label>Target Yield Min (% p.a.)</label>
                <input type="number" name="target_yield_min" value={formData.target_yield_min} onChange={handleInputChange} placeholder="6.5" step="0.1" min="0" />
              </div>
              <div className="field">
                <label>Target Yield Max (% p.a.)</label>
                <input type="number" name="target_yield_max" value={formData.target_yield_max} onChange={handleInputChange} placeholder="9.0" step="0.1" min="0" />
              </div>

              <div className="form-full field">
                <label>Preferred Industries</label>
                <div className="checkbox-grid" style={{ marginTop: "6px" }}>
                  {INDUSTRIES.map(industry => (
                    <label
                      key={industry}
                      className={`checkbox-item ${formData.preferred_industries.includes(industry) ? "checked" : ""}`}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.preferred_industries.includes(industry)}
                        onChange={() => handleCheckboxChange("preferred_industries", industry)}
                      />
                      <span className="checkbox-label">{industry}</span>
                    </label>
                  ))}
                </div>
                <div className="field-hint">Select all that apply. Leave blank to see all industries.</div>
              </div>

              <div className="form-full field">
                <label>Preferred Provinces</label>
                <div className="checkbox-grid" style={{ marginTop: "6px" }}>
                  {PROVINCES.map(province => (
                    <label
                      key={province}
                      className={`checkbox-item ${formData.preferred_provinces.includes(province) ? "checked" : ""}`}
                      style={{ cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.preferred_provinces.includes(province)}
                        onChange={() => handleCheckboxChange("preferred_provinces", province)}
                      />
                      <span className="checkbox-label">{province}</span>
                    </label>
                  ))}
                </div>
                <div className="field-hint">Select all that apply. Leave blank to see all provinces.</div>
              </div>
            </div>

            <div className="nav-buttons">
              <button className="btn btn-back" onClick={() => goToStep(1)}>← Back</button>
              <button className="btn btn-next" onClick={() => goToStep(3)}>Review Profile →</button>
            </div>
          </div>

          {/* STEP 3 — Review & Submit */}
          <div className={`step-content ${currentStep === 3 ? "active" : ""}`}>
            <div className="step-header">
              <div className="step-eyebrow">Step 3 of 3</div>
              <h1>Review & Submit</h1>
              <p>Confirm your details before going live on the marketplace.</p>
            </div>

            <div className="review-box">
              <div className="review-heading">Profile</div>
              <div className="review-grid">
                <div className="review-item">
                  <div className="review-label">Full Name</div>
                  <div className={`review-value ${!formData.full_name ? "empty" : ""}`}>{formData.full_name || "—"}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Title</div>
                  <div className={`review-value ${!formData.title ? "empty" : ""}`}>{formData.title || "—"}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Company</div>
                  <div className={`review-value ${!formData.company_name ? "empty" : ""}`}>{formData.company_name || "—"}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Phone</div>
                  <div className={`review-value ${!formData.phone ? "empty" : ""}`}>{formData.phone || "—"}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">Investor Type</div>
                  <div className={`review-value ${!formData.investor_type ? "empty" : ""}`}>{formData.investor_type || "—"}</div>
                </div>
              </div>
            </div>

            <div className="review-box">
              <div className="review-heading">Investment Mandate</div>
              <div className="review-grid">
                <div className="review-item">
                  <div className="review-label">Min Deal Size</div>
                  <div className={`review-value ${!formData.min_deal_size ? "empty" : ""}`}>
                    {formData.min_deal_size ? `$${parseFloat(formData.min_deal_size).toLocaleString()}` : "—"}
                  </div>
                </div>
                <div className="review-item">
                  <div className="review-label">Max Deal Size</div>
                  <div className={`review-value ${!formData.max_deal_size ? "empty" : ""}`}>
                    {formData.max_deal_size ? `$${parseFloat(formData.max_deal_size).toLocaleString()}` : "—"}
                  </div>
                </div>
                <div className="review-item">
                  <div className="review-label">Target Yield</div>
                  <div className={`review-value ${!formData.target_yield_min && !formData.target_yield_max ? "empty" : ""}`}>
                    {formData.target_yield_min || formData.target_yield_max
                      ? `${formData.target_yield_min || "—"}% – ${formData.target_yield_max || "—"}% p.a.`
                      : "—"}
                  </div>
                </div>
                <div className="review-item full">
                  <div className="review-label">Preferred Industries</div>
                  <div className={`review-value ${formData.preferred_industries.length === 0 ? "empty" : ""}`}>
                    {formData.preferred_industries.length > 0 ? formData.preferred_industries.join(", ") : "All industries"}
                  </div>
                </div>
                <div className="review-item full">
                  <div className="review-label">Preferred Provinces</div>
                  <div className={`review-value ${formData.preferred_provinces.length === 0 ? "empty" : ""}`}>
                    {formData.preferred_provinces.length > 0 ? formData.preferred_provinces.join(", ") : "All provinces"}
                  </div>
                </div>
              </div>
            </div>

            <div className="nav-buttons">
              <button className="btn btn-back" onClick={() => goToStep(2)}>← Back</button>
              <button
                className="btn btn-next"
                style={{ background: "var(--gold)", color: "#fff" }}
                onClick={submitApplication}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "✦ Go Live on Marketplace"}
              </button>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
