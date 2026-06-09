import { useLocation } from "wouter";

const LOGO_BEIGE = "/junni-logo-beige.png";

export default function PrivacyPolicy() {
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
          <h1>Privacy Policy</h1>
          <p className="last-updated">Last updated: April 2025</p>

          <div className="section">
            <h2>Introduction</h2>
            <p>Junni Marketplace Inc. ("we," "us," "our," or "Junni") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our marketplace platform, including our website, mobile applications, and related services (collectively, the "Platform").</p>
            <p>Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Platform. By accessing and using Junni, you acknowledge that you have read, understood, and agree to be bound by all the terms of this Privacy Policy.</p>
          </div>

          <div className="section">
            <h2>Information We Collect</h2>
            <p>We collect information in several ways:</p>
            <ul>
              <li><strong>Registration and Account Information:</strong> When you create an account, we collect your name, email address, phone number, business name, address, and tax identification numbers.</li>
              <li><strong>Financial Information:</strong> Borrowers submit financial statements, revenue data, EBITDA, debt obligations, and bank account information to enable credit scoring and marketplace visibility.</li>
              <li><strong>Identity Verification Documents:</strong> We collect government-issued identification, business licenses, and other Know Your Customer (KYC) documents required for compliance.</li>
              <li><strong>Transactional Data:</strong> We record loan requests, bids, terms, acceptance, and funding details as you use our Platform.</li>
              <li><strong>Technical Information:</strong> We automatically collect IP addresses, device types, browser information, pages visited, time spent, and interaction patterns via cookies and similar technologies.</li>
              <li><strong>Communications:</strong> We retain copies of messages, support tickets, and correspondence between users on our Platform.</li>
            </ul>
          </div>

          <div className="section">
            <h2>How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul>
              <li><strong>Platform Operation:</strong> To create and maintain your account, process transactions, and facilitate communication between borrowers and lenders.</li>
              <li><strong>Credit Scoring and Risk Assessment:</strong> To analyze financial data and generate transparent AI-driven credit scores that inform lending decisions.</li>
              <li><strong>Regulatory Compliance:</strong> To satisfy Know Your Customer (KYC), Anti-Money Laundering (AML), and other legal obligations under Canadian financial services regulations.</li>
              <li><strong>Platform Improvement:</strong> To analyze user behavior, identify trends, and enhance our features, user experience, and fraud detection systems.</li>
              <li><strong>Marketing and Communications:</strong> To send newsletters, product updates, promotional offers, and transactional notifications (you may opt out of marketing emails at any time).</li>
              <li><strong>Legal and Security:</strong> To enforce our Terms of Service, protect against fraud and unauthorized access, and respond to legal processes.</li>
            </ul>
          </div>

          <div className="section">
            <h2>Data Sharing and Disclosure</h2>
            <p><strong>We do not sell your personal information.</strong> However, we may share information in the following circumstances:</p>
            <ul>
              <li><strong>Between Marketplace Users:</strong> Borrowers' company information, loan terms, and credit scores are visible to potential lenders on our marketplace. Lenders' identity remains anonymized unless you accept their bid.</li>
              <li><strong>Service Providers:</strong> We engage third-party vendors (payment processors, document storage, analytics platforms) who process data on our behalf under strict confidentiality agreements.</li>
              <li><strong>Financial Institutions:</strong> To facilitate funding, we may share necessary transactional details with banks and lending partners.</li>
              <li><strong>Regulatory Authorities:</strong> We disclose information as required by law to comply with Canadian financial regulators, tax authorities, and law enforcement.</li>
              <li><strong>Business Transfers:</strong> If Junni is acquired or merged, your information may be transferred as part of that transaction, with notice provided.</li>
            </ul>
          </div>

          <div className="section">
            <h2>Data Security</h2>
            <p>We implement industry-standard security measures to protect your personal information, including:</p>
            <ul>
              <li>Encryption of sensitive data in transit (SSL/TLS) and at rest (AES-256).</li>
              <li>Secure authentication with password hashing and optional multi-factor authentication.</li>
              <li>Regular security audits and penetration testing by third-party firms.</li>
              <li>Restricted access to personal data on a need-to-know basis.</li>
              <li>Incident response protocols to address potential data breaches.</li>
            </ul>
            <p>While we strive to protect your information, no security system is impenetrable. We cannot guarantee absolute security, but we are committed to maintaining robust protections in compliance with Canadian privacy laws.</p>
          </div>

          <div className="section">
            <h2>Your Privacy Rights</h2>
            <p>Under Canadian privacy legislation (including PIPEDA), you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information.</li>
              <li><strong>Withdrawal of Consent:</strong> Withdraw consent for certain uses of your information (this may affect Platform functionality).</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications at any time.</li>
              <li><strong>Deletion:</strong> Request deletion of your information, subject to legal and regulatory obligations to retain certain records.</li>
            </ul>
            <p>To exercise these rights, contact us using the information in the Contact section below. We will respond to verified requests within 30 days.</p>
          </div>

          <div className="section">
            <h2>Data Retention</h2>
            <p>We retain personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. Generally:</p>
            <ul>
              <li>Account information is retained while your account is active and for 7 years thereafter for tax and compliance purposes.</li>
              <li>Transaction records are retained for 7 years to satisfy Canadian financial regulations.</li>
              <li>KYC and identity documents are retained for the duration of the business relationship plus 7 years.</li>
              <li>Marketing preferences and opt-out requests are retained indefinitely to respect your choices.</li>
            </ul>
          </div>

          <div className="section">
            <h2>Third-Party Links</h2>
            <p>Our Platform may contain links to third-party websites and applications. We are not responsible for the privacy practices of external sites. We encourage you to review their privacy policies before providing personal information.</p>
          </div>

          <div className="section">
            <h2>Contact Us</h2>
            <p>If you have questions about this Privacy Policy, wish to exercise your privacy rights, or report a data breach, please contact us:</p>
            <p>
              <strong>Junni Marketplace Inc.</strong><br />
              Privacy Officer<br />
              Email: <a href="mailto:privacy@junni.ca">privacy@junni.ca</a><br />
              Address: Suite 500, 180 King Street West, Toronto, ON M5H 1A1, Canada<br />
              Phone: 1-800-JUNNI-01
            </p>
            <p>We will respond to all privacy inquiries within 30 business days.</p>
          </div>

          <div className="section">
            <h2>Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by posting the updated policy on our Platform and updating the "Last updated" date at the top of this document. Your continued use of the Platform after such modifications constitutes your acceptance of the updated Privacy Policy.</p>
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
