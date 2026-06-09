import { useLocation } from "wouter";

const LOGO_BEIGE = "/junni-logo-beige.png";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#FAF8F4", color: "#1B2B4B", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cream: #FAF8F4;
          --navy: #1B2B4B;
          --gold: #D4940A;
          --white: #FFFFFF;
          --border: #E8E2D9;
          --text-muted: #7A7060;
          --text-secondary: #4A4035;
        }

        /* NAV */
        nav {
          height: 64px;
          border-bottom: 1px solid var(--border);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 40px;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 700;
          color: var(--navy);
        }

        .nav-logo img {
          width: 120px;
          height: auto;
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .nav-link {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s;
          cursor: pointer;
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
        }

        .nav-link:hover {
          color: var(--navy);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn {
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.12s;
          text-decoration: none;
        }

        .btn-ghost {
          background: none;
          border: 1px solid var(--border);
          color: var(--navy);
        }

        .btn-ghost:hover {
          background: rgba(27, 43, 75, 0.03);
        }

        /* MAIN */
        main {
          flex: 1;
          display: flex;
          justify-content: center;
          padding: 48px 32px;
        }

        .policy-container {
          max-width: 720px;
          width: 100%;
        }

        h1 {
          font-family: 'Fraunces', serif;
          font-size: 36px;
          font-weight: 800;
          margin-bottom: 8px;
          letter-spacing: -0.5px;
        }

        .last-updated {
          font-size: 13px;
          color: var(--text-muted);
          margin-bottom: 40px;
        }

        h2 {
          font-family: 'Fraunces', serif;
          font-size: 20px;
          font-weight: 700;
          color: var(--navy);
          margin-top: 36px;
          margin-bottom: 16px;
          letter-spacing: -0.3px;
        }

        .section:first-of-type h2 {
          margin-top: 0;
        }

        p {
          font-size: 14px;
          line-height: 1.75;
          color: var(--text-secondary);
          margin-bottom: 16px;
        }

        p:last-child {
          margin-bottom: 0;
        }

        ul {
          margin-left: 20px;
          margin-bottom: 16px;
        }

        li {
          font-size: 14px;
          line-height: 1.75;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .section {
          margin-bottom: 32px;
        }

        strong {
          font-weight: 600;
        }

        a {
          color: var(--gold);
          text-decoration: none;
          font-weight: 500;
        }

        a:hover {
          text-decoration: underline;
        }

        /* FOOTER */
        footer {
          background: #fff;
          border-top: 1px solid var(--border);
          padding: 32px;
          text-align: center;
        }

        footer p {
          font-size: 12px;
          color: var(--text-muted);
          margin: 0;
        }

        @media (max-width: 768px) {
          nav {
            padding: 0 20px;
          }
          main {
            padding: 32px 20px;
          }
          h1 {
            font-size: 28px;
          }
          h2 {
            font-size: 18px;
          }
          .nav-links {
            display: none;
          }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-left">
          <a href="/" className="nav-logo">
            <img src={LOGO_BEIGE} alt="Junni" style={{ width: "120px", height: "auto" }} />
          </a>
          <div className="nav-links">
            <button className="nav-link" onClick={() => alert("About")}>About</button>
            <button className="nav-link" onClick={() => setLocation("/marketplace")}>Marketplace</button>
          </div>
        </div>
        <div className="nav-right">
          <button className="btn btn-ghost" onClick={() => alert("Sign In")}>Sign In</button>
        </div>
      </nav>

      {/* MAIN */}
      <main>
        <div className="policy-container">
          <h1>Terms of Service</h1>
          <p className="last-updated">Last updated: April 2025</p>

          <div className="section">
            <h2>1. Acceptance of Terms</h2>
            <p>By accessing and using Junni Marketplace Inc. ("Junni," "we," "us," "our," or the "Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the Platform. We reserve the right to modify these terms at any time. Your continued use following the posting of modified terms constitutes your acceptance of the updated Terms of Service.</p>
          </div>

          <div className="section">
            <h2>2. Platform Use and Eligibility</h2>
            <p><strong>Eligibility:</strong> You must be at least 18 years old and a resident of Canada to use the Platform. By using Junni, you represent and warrant that you meet these eligibility requirements.</p>
            <p><strong>Permitted Use:</strong> The Platform is provided solely for lawful purposes. You agree not to use the Platform for any illegal activity, fraud, harassment, or any activity that violates the rights of others or Canadian law.</p>
            <p><strong>Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized access or use of your account.</p>
          </div>

          <div className="section">
            <h2>3. Borrower Terms</h2>
            <p><strong>Loan Requests:</strong> As a borrower, you may submit loan requests to the Junni marketplace. You represent that all information you provide is accurate, complete, and truthful. Misrepresentation may result in account suspension or legal action.</p>
            <p><strong>Financial Disclosure:</strong> You authorize Junni to collect, verify, and analyze your financial information, tax records, and credit data. You consent to our AI credit scoring process, which generates a transparent score visible to lenders.</p>
            <p><strong>Deal Terms:</strong> Once a lender's bid is accepted, you enter into a binding loan agreement. Junni acts as a marketplace facilitator, not a lender. All loan terms, rates, and conditions are negotiated between you and the lender.</p>
            <p><strong>Compliance:</strong> You agree to comply with all applicable Canadian financial regulations and tax obligations related to borrowed funds.</p>
          </div>

          <div className="section">
            <h2>4. Lender Terms</h2>
            <p><strong>Investment Decisions:</strong> Lenders use the Junni platform to review borrower profiles and submit competitive bids. All lending decisions are the sole responsibility of the lender. Junni provides tools and information but does not make lending recommendations or endorse any borrower.</p>
            <p><strong>Due Diligence:</strong> Lenders acknowledge that they have reviewed and understand the borrower's financial information, credit score, and deal terms before submitting a bid. Junni is not responsible for the accuracy or completeness of borrower-provided information.</p>
            <p><strong>Loan Execution:</strong> Once a borrower accepts a lender's bid, the lender agrees to fund the loan according to the agreed-upon terms. Failure to fund may result in account suspension and potential legal liability.</p>
            <p><strong>Regulatory Compliance:</strong> All lenders must comply with applicable Canadian securities laws, provincial lending regulations, and anti-money laundering requirements.</p>
          </div>

          <div className="section">
            <h2>5. Fees and Charges</h2>
            <p>Junni charges a platform fee to both borrowers and lenders as disclosed on the Platform:</p>
            <ul>
              <li><strong>Borrowers:</strong> 0.5% of the funded loan amount, charged at closing.</li>
              <li><strong>Lenders:</strong> 2.0% of the interest earned, charged monthly upon payment receipt.</li>
            </ul>
            <p>Junni reserves the right to modify fees upon 30 days' written notice. Current fees are always displayed on your account dashboard.</p>
          </div>

          <div className="section">
            <h2>6. Prohibited Activities</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Provide false, misleading, or incomplete information on the Platform.</li>
              <li>Engage in money laundering, terrorist financing, or other illegal financial activity.</li>
              <li>Attempt to manipulate loan terms, rates, or the bidding process through fraudulent means.</li>
              <li>Reverse-engineer, scrape, or attempt to circumvent the Platform's technology or security measures.</li>
              <li>Harass, threaten, or defame other users or Junni employees.</li>
              <li>Use the Platform to engage in discrimination, hate speech, or any form of unlawful conduct.</li>
              <li>Disclose confidential information about other users or the Platform's operations.</li>
            </ul>
            <p>Violation of these terms may result in immediate account termination and potential legal action.</p>
          </div>

          <div className="section">
            <h2>7. Intellectual Property</h2>
            <p>All content on the Junni Platform—including logos, design, text, graphics, software, and data—is the intellectual property of Junni or its licensors. You may not reproduce, modify, distribute, or transmit any Platform content without express written permission. Your use of the Platform grants you a limited, non-exclusive license to access and use the Platform for personal use only.</p>
          </div>

          <div className="section">
            <h2>8. Limitation of Liability</h2>
            <p><strong>Disclaimer:</strong> The Platform is provided "as-is" without warranties of any kind, express or implied. Junni does not warrant that the Platform will be error-free, uninterrupted, or secure.</p>
            <p><strong>AI Credit Scoring:</strong> The AI credit scores generated by Junni are algorithmic assessments based on submitted financial data. These scores are informational tools and do not constitute financial advice. Lenders and borrowers acknowledge that credit scores may not accurately reflect actual creditworthiness or loan performance.</p>
            <p><strong>Limitation of Damages:</strong> To the maximum extent permitted by law, Junni shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Platform, including but not limited to loss of profits, data, or business opportunities.</p>
            <p><strong>Liability Cap:</strong> Junni's total liability for any claim arising out of or relating to these Terms or the Platform shall not exceed the fees you paid to Junni in the 12 months preceding the claim.</p>
          </div>

          <div className="section">
            <h2>9. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless Junni, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses arising from:</p>
            <ul>
              <li>Your breach of these Terms of Service.</li>
              <li>Your violation of any applicable law or regulation.</li>
              <li>Your use of the Platform in a manner that infringes the rights of others.</li>
              <li>Any content you provide or post on the Platform.</li>
            </ul>
          </div>

          <div className="section">
            <h2>10. Dispute Resolution</h2>
            <p><strong>Negotiation:</strong> In the event of a dispute between a borrower and lender, both parties agree to attempt good-faith negotiation to resolve the matter.</p>
            <p><strong>Mediation:</strong> If negotiation fails, both parties agree to submit to non-binding mediation before pursuing litigation. Junni may participate as a neutral mediator.</p>
            <p><strong>Arbitration:</strong> Any unresolved disputes shall be subject to binding arbitration under Canadian arbitration law, with disputes heard by a single arbitrator in Toronto, Ontario.</p>
            <p><strong>Junni Disputes:</strong> Disputes directly between you and Junni (not involving another user) shall be governed by the terms of this clause and subject to arbitration or court proceedings as outlined above.</p>
          </div>

          <div className="section">
            <h2>11. Governing Law</h2>
            <p>These Terms of Service are governed by the laws of the Province of Ontario and the federal laws of Canada applicable therein, without regard to conflict of law principles. You irrevocably submit to the exclusive jurisdiction of the courts located in Ontario.</p>
          </div>

          <div className="section">
            <h2>12. Termination</h2>
            <p>Junni may suspend or terminate your account at any time, with or without cause, by providing written notice. Upon termination, all rights granted to you shall cease immediately. You remain liable for any outstanding fees or obligations incurred before termination.</p>
            <p>You may request account closure at any time by contacting <a href="mailto:support@junni.ca">support@junni.ca</a>. Closure is effective once all outstanding obligations are settled.</p>
          </div>

          <div className="section">
            <h2>13. Amendments and Updates</h2>
            <p>Junni reserves the right to amend these Terms of Service at any time. Material changes will be communicated via email or through a prominent notice on the Platform. Your continued use of the Platform following the posting of revised Terms constitutes your acceptance of the revisions.</p>
          </div>

          <div className="section">
            <h2>14. Contact Information</h2>
            <p>For questions about these Terms of Service, please contact:</p>
            <p>
              <strong>Junni Marketplace Inc.</strong><br />
              Legal Department<br />
              Email: <a href="mailto:legal@junni.ca">legal@junni.ca</a><br />
              Address: Suite 500, 180 King Street West, Toronto, ON M5H 1A1, Canada<br />
              Phone: 1-800-JUNNI-01
            </p>
          </div>

          <div className="section">
            <h2>15. Severability</h2>
            <p>If any provision of these Terms is found to be unenforceable or invalid, that provision shall be modified to the minimum extent necessary to make it valid, or if such modification is not possible, that provision shall be severed. The remaining provisions shall continue in full force and effect.</p>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer>
        <p>&copy; 2025 Junni Marketplace Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
