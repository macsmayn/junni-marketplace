import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth0 } from "@auth0/auth0-react";
import { supabase } from '../lib/supabase';

const LOGO_NAVY = "/junni-logo-navy.png";
const SCORE_DEAL_URL = "https://sypqecydiqdpruarkrvy.supabase.co/functions/v1/score-deal";

const ADMIN_NAV_ITEMS = [
  { icon: "◉", text: "Overview", badge: null },
  { icon: "📋", text: "Deals", badge: null },
  { icon: "👥", text: "Users", badge: null },
  { icon: "🔍", text: "KYC Review", badge: "3" },
  { icon: "💼", text: "Bids", badge: null },
];
const ADMIN_ACCOUNT_ITEMS = [
  { icon: "📊", text: "Analytics", badge: null },
  { icon: "⚙️", text: "Settings", badge: null },
];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const fmtAmount = (n: number | null | undefined) =>
  n != null ? `$${Number(n).toLocaleString()}` : "—";
const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function AdminPanel() {
  const [, setLocation] = useLocation();
  const { user: auth0User } = useAuth0();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0=Questions, 1=Deals, 2=Users, 3=KYC, 4=Bids
  const [topbarVisible, setTopbarVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Questions state
  const [questions, setQuestions] = useState<any[]>([]);
  const [dealTitles, setDealTitles] = useState<Record<string, string>>({});
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Deals state
  const [dealsList, setDealsList] = useState<any[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set());
  const [editingDeal, setEditingDeal] = useState<any | null>(null);
  const [editDealForm, setEditDealForm] = useState<Record<string, any>>({});
  const [rescoringDealId, setRescoringDealId] = useState<string | null>(null);
  const [rescoreFailedDealId, setRescoreFailedDealId] = useState<string | null>(null);

  // Users state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [dealCountByUser, setDealCountByUser] = useState<Record<string, number>>({});
  const [allowlistedEmails, setAllowlistedEmails] = useState<Set<string>>(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [viewingUser, setViewingUser] = useState<any | null>(null);
  const [editUserForm, setEditUserForm] = useState<Record<string, any>>({});
  const [userModalDeals, setUserModalDeals] = useState<any[]>([]);
  const [userModalBids, setUserModalBids] = useState<any[]>([]);
  const [userModalLoading, setUserModalLoading] = useState(false);

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
    (async () => {
      setQuestionsLoading(true);
      setDealsLoading(true);
      setUsersLoading(true);
      const [{ data: qData }, { data: dlData }, { data: ulData }, { data: alData }] = await Promise.all([
        supabase.from("credit_questions").select("*").eq("status", "pending_review").order("deal_id"),
        supabase.from("deals").select("*, users!deals_borrower_id_fkey(full_name, email)").order("created_at", { ascending: false }),
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("admin_allowlist").select("email"),
      ]);

      // Questions
      const sorted = (qData ?? []).slice().sort((a, b) => {
        if (a.deal_id < b.deal_id) return -1;
        if (a.deal_id > b.deal_id) return 1;
        return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      });
      setQuestions(sorted);
      const titlesMap: Record<string, string> = {};
      for (const d of (dlData ?? [])) titlesMap[d.id] = d.title;
      setDealTitles(titlesMap);
      setQuestionsLoading(false);

      // Deals
      setDealsList(dlData ?? []);
      setDealsLoading(false);

      // Deal count by borrower_id
      const countMap: Record<string, number> = {};
      for (const d of (dlData ?? [])) {
        if (d.borrower_id) countMap[d.borrower_id] = (countMap[d.borrower_id] ?? 0) + 1;
      }
      setDealCountByUser(countMap);

      // Users
      setUsersList(ulData ?? []);
      setUsersLoading(false);

      // Allowlisted emails (lowercased)
      const allowSet = new Set<string>((alData ?? []).map((r: any) => (r.email ?? "").toLowerCase().trim()));
      setAllowlistedEmails(allowSet);
    })();
  }, []);

  // ── Questions handlers ──────────────────────────────────────────────
  const handleApprove = async (q: any) => {
    const { error } = await supabase.from("credit_questions").update({ status: "approved" }).eq("id", q.id);
    if (!error) setQuestions(prev => prev.filter(x => x.id !== q.id));
  };

  const handleReject = async (q: any) => {
    if (!window.confirm("Reject this question? It won't be shown to the borrower.")) return;
    const { error } = await supabase.from("credit_questions").update({ status: "dismissed" }).eq("id", q.id);
    if (!error) setQuestions(prev => prev.filter(x => x.id !== q.id));
  };

  const handleEditStart = (q: any) => {
    setEditingId(q.id);
    setEditText(q.question_text);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleEditSave = async (q: any) => {
    const existing = q.input_fields ?? {};
    const updatedFields = existing.original_question_text
      ? existing
      : { ...existing, original_question_text: q.question_text };
    const { error } = await supabase
      .from("credit_questions")
      .update({ question_text: editText, input_fields: updatedFields })
      .eq("id", q.id);
    if (!error) {
      setQuestions(prev =>
        prev.map(x => x.id === q.id ? { ...x, question_text: editText, input_fields: updatedFields } : x)
      );
      setEditingId(null);
      setEditText("");
    }
  };

  // ── Deals handlers ──────────────────────────────────────────────────
  const handleStatusChange = async (dealId: string, newStatus: string) => {
    await supabase.from("deals").update({ status: newStatus }).eq("id", dealId);
    setDealsList(prev => prev.map(d => d.id === dealId ? { ...d, status: newStatus } : d));
  };

  const handleDealEditStart = (deal: any) => {
    setEditingDeal(deal);
    setEditDealForm({
      title: deal.title ?? "",
      industry: deal.industry ?? "",
      amount_requested: deal.amount_requested ?? "",
      annual_revenue: deal.annual_revenue ?? "",
      ebitda: deal.ebitda ?? "",
      years_in_business: deal.years_in_business ?? "",
      ai_score: deal.ai_score ?? "",
      status: deal.status ?? "pending",
    });
    setRescoreFailedDealId(null);
  };

  const handleDealEditSave = async () => {
    if (!editingDeal) return;
    const orig = editingDeal;
    const toNum = (v: any) => (v === "" || v == null) ? null : Number(v);

    const updates = {
      title: editDealForm.title,
      industry: editDealForm.industry,
      amount_requested: toNum(editDealForm.amount_requested),
      annual_revenue: toNum(editDealForm.annual_revenue),
      ebitda: toNum(editDealForm.ebitda),
      years_in_business: toNum(editDealForm.years_in_business),
      ai_score: toNum(editDealForm.ai_score),
      status: editDealForm.status,
    };

    const { error } = await supabase.from("deals").update(updates).eq("id", orig.id);
    if (error) return;

    setDealsList(prev => prev.map(d => d.id === orig.id ? { ...d, ...updates } : d));
    setEditingDeal(null);

    const financialChanged =
      updates.amount_requested !== orig.amount_requested ||
      updates.annual_revenue !== orig.annual_revenue ||
      updates.ebitda !== orig.ebitda;

    if (financialChanged) {
      setRescoringDealId(orig.id);
      setRescoreFailedDealId(null);
      try {
        await fetch(SCORE_DEAL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deal_id: orig.id }),
        });
        const { data: refreshed } = await supabase
          .from("deals")
          .select("*, users!deals_borrower_id_fkey(full_name, email)")
          .eq("id", orig.id)
          .single();
        if (refreshed) setDealsList(prev => prev.map(d => d.id === orig.id ? refreshed : d));
      } catch (_e) {
        setRescoreFailedDealId(orig.id);
      } finally {
        setRescoringDealId(null);
      }
    }
  };

  const toggleDealSelect = (id: string) => {
    setSelectedDealIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedDealIds(
      selectedDealIds.size === dealsList.length && dealsList.length > 0
        ? new Set()
        : new Set(dealsList.map(d => d.id))
    );
  };

  const handleDeleteSelected = async () => {
    const ids = [...selectedDealIds];
    if (!window.confirm(
      `Delete ${ids.length} deal(s)? This permanently removes the deal(s) and ALL associated bids, documents, financials, credit flags, and questions. This cannot be undone.`
    )) return;
    const { error } = await supabase.from("deals").delete().in("id", ids);
    if (!error) {
      setDealsList(prev => prev.filter(d => !selectedDealIds.has(d.id)));
      setSelectedDealIds(new Set());
    }
  };

  // ── Users handlers ──────────────────────────────────────────────────
  const handleUserRoleChange = async (userId: string, newRole: string) => {
    await supabase.from("users").update({ role: newRole }).eq("id", userId);
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleUserKycChange = async (userId: string, newKyc: string) => {
    await supabase.from("users").update({ kyc_status: newKyc }).eq("id", userId);
    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, kyc_status: newKyc } : u));
  };

  const getDeletableUsers = () => usersList.filter(u =>
    u.auth0_id !== auth0User?.sub &&
    !allowlistedEmails.has((u.email ?? "").toLowerCase().trim())
  );

  const toggleUserSelect = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllUsers = () => {
    const deletable = getDeletableUsers();
    setSelectedUserIds(
      selectedUserIds.size === deletable.length && deletable.length > 0
        ? new Set()
        : new Set(deletable.map(u => u.id))
    );
  };

  const handleDeleteSelectedUsers = async () => {
    const ids = [...selectedUserIds];
    if (!window.confirm(
      `Delete ${ids.length} user(s)? This permanently removes the user(s) AND all of their deals, and every bid, document, financial record, and question associated with those deals. This cannot be undone.`
    )) return;
    const { error } = await supabase.from("users").delete().in("id", ids);
    if (!error) {
      setUsersList(prev => prev.filter(u => !selectedUserIds.has(u.id)));
      setSelectedUserIds(new Set());
    }
  };

  const handleViewUser = async (u: any) => {
    setViewingUser(u);
    setEditUserForm({
      full_name: u.full_name ?? "",
      email: u.email ?? "",
      role: u.role ?? "borrower",
      kyc_status: u.kyc_status ?? "pending",
      company_name: u.company_name ?? "",
      phone: u.phone ?? "",
    });
    setUserModalDeals([]);
    setUserModalBids([]);
    setUserModalLoading(true);
    const [{ data: uDeals }, { data: uBids }] = await Promise.all([
      supabase.from("deals").select("id, title, status, amount_requested").eq("borrower_id", u.id),
      supabase.from("bids").select("id, amount, rate, status, deal_id, deals(title)").eq("lender_id", u.id),
    ]);
    setUserModalDeals(uDeals ?? []);
    setUserModalBids(uBids ?? []);
    setUserModalLoading(false);
  };

  const handleUserEditSave = async () => {
    if (!viewingUser) return;
    const updates = {
      full_name: editUserForm.full_name,
      email: editUserForm.email,
      role: editUserForm.role,
      kyc_status: editUserForm.kyc_status,
      company_name: editUserForm.company_name,
      phone: editUserForm.phone,
    };
    const { error } = await supabase.from("users").update(updates).eq("id", viewingUser.id);
    if (error) return;
    setUsersList(prev => prev.map(u => u.id === viewingUser.id ? { ...u, ...updates } : u));
    setViewingUser((prev: any) => prev ? { ...prev, ...updates } : null);
  };

  // ── Hardcoded data (tabs not yet converted) ─────────────────────────
  const kycData = [
    {
      company: "Volterra Tech", borrower: "Sophie Bélanger", submitted: "Apr 14, 2025",
      docs: [
        { name: "Business License", status: "pending" },
        { name: "Tax ID / CRA Number", status: "uploaded" },
        { name: "Bank Statement", status: "pending" },
      ],
    },
    {
      company: "Prairie Health", borrower: "David Park", submitted: "Apr 10, 2025",
      docs: [
        { name: "Business License", status: "uploaded" },
        { name: "Tax ID / CRA Number", status: "uploaded" },
        { name: "Bank Statement", status: "uploaded" },
      ],
    },
    {
      company: "Cascade Logistics", borrower: "Alex Chen", submitted: "Apr 8, 2025",
      docs: [
        { name: "Business License", status: "uploaded" },
        { name: "Tax ID / CRA Number", status: "pending" },
        { name: "Bank Statement", status: "uploaded" },
      ],
    },
  ];

  const bidsData = [
    { deal: "Maple Ridge Mfg.", lender: "Lender #4821", rate: "6.9%", amount: "$200K", term: "36 mo", submitted: "Apr 15", status: "Accepted", statusBadge: "b-active" },
    { deal: "Maple Ridge Mfg.", lender: "Lender #2194", rate: "7.1%", amount: "$300K", term: "36 mo", submitted: "Apr 15", status: "Pending", statusBadge: "b-review" },
    { deal: "Northern Harvest", lender: "Lender #5502", rate: "7.0%", amount: "$500K", term: "48 mo", submitted: "Apr 12", status: "Accepted", statusBadge: "b-active" },
    { deal: "Atlantic Energy", lender: "Lender #1203", rate: "6.5%", amount: "$2.0M", term: "60 mo", submitted: "Apr 8", status: "Accepted", statusBadge: "b-active" },
    { deal: "Prairie Health", lender: "Lender #7845", rate: "7.3%", amount: "$500K", term: "36 mo", submitted: "Apr 14", status: "Pending", statusBadge: "b-review" },
  ];

  // ── Edit Deal modal ─────────────────────────────────────────────────
  const dealEditModal = editingDeal ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 700, color: "#1B2B4B" }}>Edit Deal</div>
          <button onClick={() => setEditingDeal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#7A7060", lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: "grid", gap: "12px" }}>
          {([
            { label: "Title", key: "title", type: "text" },
            { label: "Industry", key: "industry", type: "text" },
            { label: "Amount Requested ($)", key: "amount_requested", type: "number" },
            { label: "Annual Revenue ($)", key: "annual_revenue", type: "number" },
            { label: "EBITDA ($)", key: "ebitda", type: "number" },
            { label: "Years in Business", key: "years_in_business", type: "number" },
            { label: "AI Score (0–100)", key: "ai_score", type: "number" },
          ] as { label: string; key: string; type: string }[]).map(({ label, key, type }) => (
            <div key={key}>
              <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7A7060", marginBottom: "5px" }}>{label}</div>
              <input
                type={type}
                value={editDealForm[key]}
                onChange={e => setEditDealForm(prev => ({ ...prev, [key]: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #E8E2D9", borderRadius: "6px", fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#1B2B4B", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7A7060", marginBottom: "5px" }}>Status</div>
            <select
              value={editDealForm.status}
              onChange={e => setEditDealForm(prev => ({ ...prev, status: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid #E8E2D9", borderRadius: "6px", fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#1B2B4B", background: "#fff", outline: "none", boxSizing: "border-box" }}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="funded">Funded</option>
              <option value="closed">Closed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #E8E2D9" }}>
          <button className="a-btn a-btn-navy" onClick={handleDealEditSave}>Save</button>
          <button className="a-btn a-btn-ghost" onClick={() => setEditingDeal(null)}>Cancel</button>
        </div>
        <div style={{ fontSize: "11px", color: "#7A7060", marginTop: "10px" }}>
          Changes to Amount Requested, Annual Revenue, or EBITDA will trigger automatic re-scoring.
        </div>
      </div>
    </div>
  ) : null;

  // ── User detail modal ───────────────────────────────────────────────
  const fieldStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #E8E2D9", borderRadius: "6px", fontFamily: "Inter, sans-serif", fontSize: "14px", color: "#1B2B4B", outline: "none", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7A7060", marginBottom: "5px" };
  const sectionHeadStyle: React.CSSProperties = { fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#1B2B4B", marginBottom: "10px" };

  const userDetailModal = viewingUser ? (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,27,48,0.55)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", width: "100%", maxWidth: "620px", maxHeight: "92vh", overflowY: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontFamily: "Fraunces, serif", fontSize: "18px", fontWeight: 700, color: "#1B2B4B" }}>
              {viewingUser.full_name ?? viewingUser.email ?? "User"}
            </div>
            <div style={{ fontSize: "12px", color: "#7A7060", marginTop: "2px" }}>{viewingUser.auth0_id}</div>
          </div>
          <button onClick={() => setViewingUser(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#7A7060", lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        {/* Edit form */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <div style={labelStyle}>Full Name</div>
            <input type="text" value={editUserForm.full_name} onChange={e => setEditUserForm(p => ({ ...p, full_name: e.target.value }))} style={fieldStyle} />
          </div>
          <div>
            <div style={labelStyle}>Company Name</div>
            <input type="text" value={editUserForm.company_name} onChange={e => setEditUserForm(p => ({ ...p, company_name: e.target.value }))} style={fieldStyle} />
          </div>
          <div>
            <div style={labelStyle}>Email</div>
            <input type="email" value={editUserForm.email} onChange={e => setEditUserForm(p => ({ ...p, email: e.target.value }))} style={fieldStyle} />
          </div>
          <div>
            <div style={labelStyle}>Phone</div>
            <input type="text" value={editUserForm.phone} onChange={e => setEditUserForm(p => ({ ...p, phone: e.target.value }))} style={fieldStyle} />
          </div>
          <div>
            <div style={labelStyle}>Role</div>
            <select value={editUserForm.role} onChange={e => setEditUserForm(p => ({ ...p, role: e.target.value }))} style={{ ...fieldStyle, background: "#fff" }}>
              <option value="borrower">Borrower</option>
              <option value="lender">Lender</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>KYC Status</div>
            <select value={editUserForm.kyc_status} onChange={e => setEditUserForm(p => ({ ...p, kyc_status: e.target.value }))} style={{ ...fieldStyle, background: "#fff" }}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        <div style={{ fontSize: "11px", color: "#7A7060", marginBottom: "14px" }}>
          Note: editing the email field does not change their login (tied to Auth0), but may affect admin allowlist matching.
        </div>
        <div style={{ display: "flex", gap: "10px", paddingBottom: "20px", borderBottom: "1px solid #E8E2D9" }}>
          <button className="a-btn a-btn-navy" onClick={handleUserEditSave}>Save Changes</button>
          <button className="a-btn a-btn-ghost" onClick={() => setViewingUser(null)}>Close</button>
        </div>

        {/* Deals & Bids */}
        {userModalLoading ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#7A7060", fontSize: "13px" }}>Loading activity…</div>
        ) : (
          <>
            {/* Deals */}
            <div style={{ marginTop: "20px", marginBottom: "16px" }}>
              <div style={sectionHeadStyle}>Deals ({userModalDeals.length})</div>
              {userModalDeals.length === 0 ? (
                <div style={{ fontSize: "13px", color: "#7A7060" }}>No deals.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {userModalDeals.map(d => (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(27,43,75,0.02)", border: "1px solid #E8E2D9", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1B2B4B" }}>{d.title ?? "Untitled"}</div>
                        <div style={{ fontSize: "11px", color: "#7A7060", marginTop: "2px" }}>{fmtAmount(d.amount_requested)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: d.status === "active" ? "rgba(5,150,105,0.08)" : "rgba(27,43,75,0.07)", color: d.status === "active" ? "#059669" : "#1B2B4B" }}>{d.status ?? "—"}</span>
                        <button className="a-btn a-btn-ghost" style={{ padding: "5px 10px", fontSize: "11px" }} onClick={() => { setViewingUser(null); setLocation(`/deals/${d.id}`); }}>View</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bids */}
            <div>
              <div style={sectionHeadStyle}>Bids ({userModalBids.length})</div>
              {userModalBids.length === 0 ? (
                <div style={{ fontSize: "13px", color: "#7A7060" }}>No bids.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {userModalBids.map(b => (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "rgba(27,43,75,0.02)", border: "1px solid #E8E2D9", borderRadius: "8px" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1B2B4B" }}>{b.deals?.title ?? `Deal ${String(b.deal_id).slice(0, 8)}…`}</div>
                        <div style={{ fontSize: "11px", color: "#7A7060", marginTop: "2px" }}>
                          {fmtAmount(b.amount)}{b.rate ? ` · ${b.rate}%` : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", background: b.status === "accepted" ? "rgba(5,150,105,0.08)" : "rgba(27,43,75,0.07)", color: b.status === "accepted" ? "#059669" : "#1B2B4B" }}>{b.status ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  // ── Tab content renderer ────────────────────────────────────────────
  const renderTabContent = (mobile: boolean) => {
    const thPad = mobile ? "10px 10px" : "12px 16px";
    const tdPad = mobile ? "10px 10px" : "12px 16px";
    const tableStyle = mobile ? { fontSize: "11px" } : {};
    const selectStyle: React.CSSProperties = { border: "1px solid #E8E2D9", borderRadius: "6px", padding: "4px 6px", fontFamily: "Inter, sans-serif", fontSize: mobile ? "10px" : "11px", color: "#1B2B4B", background: "#fff", cursor: "pointer", outline: "none" };

    // ── Questions (tab 0) ──
    if (activeTab === 0) {
      if (questionsLoading) return <div className="q-empty">Loading questions…</div>;
      if (questions.length === 0) return <div className="q-empty">No questions pending review.</div>;
      const dealIds = [...new Set(questions.map(q => q.deal_id))];
      return (
        <>
          {dealIds.map(dealId => {
            const dealQs = questions.filter(q => q.deal_id === dealId);
            const title = dealTitles[dealId] ?? `Deal ${String(dealId).slice(0, 8)}…`;
            return (
              <div key={dealId} className="q-deal-group">
                <div className="q-deal-header">
                  {title}
                  <span className="q-deal-count">{dealQs.length} pending</span>
                </div>
                {dealQs.map(q => {
                  const grounded = q.input_fields?.grounded_in;
                  const isEditing = editingId === q.id;
                  const priLabel = q.priority ? q.priority.charAt(0).toUpperCase() + q.priority.slice(1) : "Medium";
                  return (
                    <div key={q.id} className="q-card">
                      <div className="q-card-meta">
                        <span className={q.source === "ai" ? "q-source-ai" : "q-source-rule"}>{q.source === "ai" ? "AI" : "Rule"}</span>
                        <span className={`q-pri-${q.priority ?? "medium"}`}>{priLabel}</span>
                        {q.related_metric && <span className="q-metric">{q.related_metric}</span>}
                      </div>
                      {isEditing ? (
                        <>
                          <textarea className="q-textarea" value={editText} onChange={e => setEditText(e.target.value)} />
                          <div className="q-actions">
                            <button className="a-btn a-btn-navy" onClick={() => handleEditSave(q)}>Save</button>
                            <button className="a-btn a-btn-ghost" onClick={handleEditCancel}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="q-text">{q.question_text}</div>
                          {q.source === "ai" && grounded && (
                            <div className="q-grounded"><strong>Grounded in:</strong> {grounded}</div>
                          )}
                          <div className="q-actions">
                            <button className="a-btn a-btn-green" onClick={() => handleApprove(q)}>Approve</button>
                            <button className="a-btn a-btn-ghost" onClick={() => handleEditStart(q)}>Edit</button>
                            <button className="a-btn a-btn-red" onClick={() => handleReject(q)}>Reject</button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      );
    }

    // ── Deals (tab 1) ──
    if (activeTab === 1) {
      if (dealsLoading) return <div className="q-empty">Loading deals…</div>;
      if (dealsList.length === 0) return <div className="q-empty">No deals found.</div>;
      const allSelected = selectedDealIds.size === dealsList.length && dealsList.length > 0;
      return (
        <>
          {selectedDealIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", color: "#7A7060" }}>{selectedDealIds.size} selected</span>
              <button className="a-btn a-btn-red" onClick={handleDeleteSelected}>Delete selected ({selectedDealIds.size})</button>
            </div>
          )}
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", ...tableStyle }}>
              <thead>
                <tr>
                  <th style={{ padding: thPad, borderBottom: "1px solid #E8E2D9", background: "rgba(27,43,75,0.02)", width: "32px" }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
                  </th>
                  {["Title", "Borrower", "Industry", "Amount", "AI Score", "Status", "Created", "Actions"].map(h => (
                    <th key={h} style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7A7060", padding: thPad, textAlign: "left", borderBottom: "1px solid #E8E2D9", background: "rgba(27,43,75,0.02)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dealsList.map((deal, idx) => {
                  const isRescoring = rescoringDealId === deal.id;
                  const rescoreFailed = rescoreFailedDealId === deal.id;
                  const borrowerName = deal.users?.full_name ?? deal.users?.email ?? "—";
                  return (
                    <tr key={deal.id} style={{ borderBottom: idx < dealsList.length - 1 ? "1px solid #E8E2D9" : "none", background: selectedDealIds.has(deal.id) ? "rgba(212,148,10,0.04)" : undefined, opacity: isRescoring ? 0.7 : 1 }}>
                      <td style={{ padding: tdPad }}>
                        <input type="checkbox" checked={selectedDealIds.has(deal.id)} onChange={() => toggleDealSelect(deal.id)} style={{ cursor: "pointer" }} />
                      </td>
                      <td style={{ padding: tdPad, fontWeight: 600, color: "#1B2B4B", maxWidth: mobile ? "140px" : "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{deal.title ?? "Untitled"}</td>
                      <td style={{ padding: tdPad, color: "#7A7060" }}>{borrowerName}</td>
                      <td style={{ padding: tdPad, color: "#7A7060" }}>{deal.industry ?? "—"}</td>
                      <td style={{ padding: tdPad, fontWeight: 600, color: "#1B2B4B" }}>{fmtAmount(deal.amount_requested)}</td>
                      <td style={{ padding: tdPad }}>
                        {isRescoring ? <span style={{ fontSize: "11px", color: "#D4940A", fontStyle: "italic" }}>Re-scoring…</span>
                          : rescoreFailed ? <span style={{ fontSize: "11px", color: "#DC2626" }}>{deal.ai_score ?? "—"} ⚠</span>
                          : <span style={{ fontWeight: 700, color: "#1B2B4B" }}>{deal.ai_score ?? "—"}</span>}
                      </td>
                      <td style={{ padding: tdPad }}>
                        <select value={deal.status ?? "pending"} onChange={e => handleStatusChange(deal.id, e.target.value)} style={selectStyle}>
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="funded">Funded</option>
                          <option value="closed">Closed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td style={{ padding: tdPad, color: "#7A7060", whiteSpace: "nowrap" }}>{fmtDate(deal.created_at)}</td>
                      <td style={{ padding: tdPad }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="a-btn a-btn-ghost" onClick={() => setLocation(`/deals/${deal.id}`)}>View</button>
                          <button className="a-btn a-btn-ghost" onClick={() => handleDealEditStart(deal)}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rescoreFailedDealId && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: "#DC2626" }}>
              ⚠ Re-scoring failed for one deal — financial fields were saved. Score will update on next manual re-score.
            </div>
          )}
        </>
      );
    }

    // ── Users (tab 2) ──
    if (activeTab === 2) {
      if (usersLoading) return <div className="q-empty">Loading users…</div>;
      if (usersList.length === 0) return <div className="q-empty">No users found.</div>;

      const deletableUsers = getDeletableUsers();
      const allUsersSelected = deletableUsers.length > 0 && selectedUserIds.size === deletableUsers.length;

      return (
        <>
          {selectedUserIds.size > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontSize: "12px", color: "#7A7060" }}>{selectedUserIds.size} selected</span>
              <button className="a-btn a-btn-red" onClick={handleDeleteSelectedUsers}>Delete selected ({selectedUserIds.size})</button>
            </div>
          )}
          <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", ...tableStyle }}>
              <thead>
                <tr>
                  <th style={{ padding: thPad, borderBottom: "1px solid #E8E2D9", background: "rgba(27,43,75,0.02)", width: "40px" }}>
                    <input type="checkbox" checked={allUsersSelected} onChange={toggleSelectAllUsers} style={{ cursor: "pointer" }} />
                  </th>
                  {["Name", "Email", "Role", "KYC Status", "Joined", "Deals", "Actions"].map(h => (
                    <th key={h} style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7A7060", padding: thPad, textAlign: "left", borderBottom: "1px solid #E8E2D9", background: "rgba(27,43,75,0.02)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersList.map((u, idx) => {
                  const isOwnRow = u.auth0_id === auth0User?.sub;
                  const isProtected = allowlistedEmails.has((u.email ?? "").toLowerCase().trim());
                  return (
                    <tr key={u.id} style={{ borderBottom: idx < usersList.length - 1 ? "1px solid #E8E2D9" : "none", background: selectedUserIds.has(u.id) ? "rgba(212,148,10,0.04)" : undefined }}>
                      <td style={{ padding: tdPad, textAlign: "center" }}>
                        {isProtected ? (
                          <span title="Protected admin — cannot be deleted" style={{ fontSize: "13px" }}>🔒</span>
                        ) : (
                          <input
                            type="checkbox"
                            disabled={isOwnRow}
                            checked={selectedUserIds.has(u.id)}
                            onChange={() => toggleUserSelect(u.id)}
                            style={{ cursor: isOwnRow ? "not-allowed" : "pointer", opacity: isOwnRow ? 0.4 : 1 }}
                          />
                        )}
                      </td>
                      <td style={{ padding: tdPad, fontWeight: 600, color: "#1B2B4B" }}>
                        {u.full_name ?? "—"}
                        {isOwnRow && <span style={{ fontSize: "9px", color: "#7A7060", marginLeft: "6px", fontWeight: 400 }}>(you)</span>}
                      </td>
                      <td style={{ padding: tdPad, color: "#7A7060", maxWidth: mobile ? "100px" : "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email ?? "—"}</td>
                      <td style={{ padding: tdPad }}>
                        <select value={u.role ?? "borrower"} onChange={e => handleUserRoleChange(u.id, e.target.value)} style={selectStyle}>
                          <option value="borrower">Borrower</option>
                          <option value="lender">Lender</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: tdPad }}>
                        <select value={u.kyc_status ?? "pending"} onChange={e => handleUserKycChange(u.id, e.target.value)} style={selectStyle}>
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                      <td style={{ padding: tdPad, color: "#7A7060", whiteSpace: "nowrap" }}>{fmtDate(u.created_at)}</td>
                      <td style={{ padding: tdPad, color: "#1B2B4B", fontWeight: 600 }}>{dealCountByUser[u.id] ?? 0}</td>
                      <td style={{ padding: tdPad }}>
                        <button className="a-btn a-btn-ghost" onClick={() => handleViewUser(u)}>View / Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    // ── KYC Review (tab 3) ──
    if (activeTab === 3) return (
      <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3,1fr)", gap: "14px" }}>
        {kycData.map((kyc, idx) => (
          <div key={idx} style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#1B2B4B", marginBottom: "3px" }}>{kyc.company}</div>
            <div style={{ fontSize: "12px", color: "#7A7060", marginBottom: "4px" }}>{kyc.borrower}</div>
            <div style={{ fontSize: "11px", color: "#7A7060", marginBottom: "14px" }}>Submitted {kyc.submitted}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
              {kyc.docs.map((doc, docIdx) => (
                <div key={docIdx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px", background: "rgba(27,43,75,0.03)", borderRadius: "6px", fontSize: "12px" }}>
                  <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: doc.status === "uploaded" ? "#059669" : "#D97706", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0 }}>
                    {doc.status === "uploaded" ? "✓" : "⏳"}
                  </span>
                  <span style={{ color: "#1B2B4B" }}>{doc.name}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px", paddingTop: "12px", borderTop: "1px solid #E8E2D9", flexWrap: "wrap" }}>
              <button className="a-btn a-btn-green" onClick={() => alert("Approve KYC")}>Approve KYC</button>
              <button className="a-btn a-btn-red" onClick={() => alert("Reject")}>Reject</button>
              <button className="a-btn a-btn-ghost" onClick={() => alert("View Documents")}>View Docs</button>
            </div>
          </div>
        ))}
      </div>
    );

    // ── Bids (tab 4) ──
    if (activeTab === 4) return (
      <div style={{ background: "#fff", border: "1px solid #E8E2D9", borderRadius: "12px", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...tableStyle }}>
          <thead>
            <tr>
              {["Deal", "Lender", "Rate", "Amount", "Term", "Submitted", "Status"].map(h => (
                <th key={h} style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7A7060", padding: thPad, textAlign: "left", borderBottom: "1px solid #E8E2D9", background: "rgba(27,43,75,0.02)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bidsData.map((bid, idx) => (
              <tr key={idx} style={{ borderBottom: idx < bidsData.length - 1 ? "1px solid #E8E2D9" : "none" }}>
                <td style={{ padding: tdPad, fontWeight: 600, color: "#1B2B4B" }}>{bid.deal}</td>
                <td style={{ padding: tdPad, color: "#7A7060" }}>{bid.lender}</td>
                <td style={{ padding: tdPad, fontWeight: 700, color: "#1B2B4B" }}>{bid.rate}</td>
                <td style={{ padding: tdPad, color: "#1B2B4B" }}>{bid.amount}</td>
                <td style={{ padding: tdPad, color: "#1B2B4B" }}>{bid.term}</td>
                <td style={{ padding: tdPad, color: "#7A7060" }}>{bid.submitted}</td>
                <td style={{ padding: tdPad }}><span className={`badge ${bid.statusBadge}`}>{bid.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return null;
  };

  // ── SHARED CSS BLOCKS ───────────────────────────────────────────────
  const mobileCSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --cream: #FAF8F4; --navy: #1B2B4B; --gold: #D4940A; --border: #E8E2D9; --text-muted: #7A7060; --green: #059669; --red: #DC2626; }
    html, body { background: var(--cream); font-family: 'Inter', sans-serif; }
    body { padding-top: 56px; }

    .navbar { position: fixed; top: 0; left: 0; right: 0; height: 56px; background: #fff; border-bottom: 1px solid var(--border); z-index: 250; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; }
    .nav-left { display: flex; align-items: center; gap: 10px; }
    .hamburger { background: none; border: none; cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 4px; width: 30px; }
    .hamburger span { display: block; height: 2px; background: var(--navy); border-radius: 2px; }
    .nav-title { font-size: 15px; font-weight: 600; color: var(--navy); }

    .content { padding: 16px 14px 40px; display: flex; flex-direction: column; gap: 18px; }

    .alert-bar { background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15); border-radius: 10px; padding: 12px 14px; }
    .alert-bar p { font-size: 12px; font-weight: 600; color: var(--red); margin-bottom: 2px; }
    .alert-bar span { font-size: 11px; color: var(--text-muted); }

    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .stat-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
    .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 6px; }
    .stat-num { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; }
    .stat-num.gold { color: var(--gold); }
    .stat-num.red { color: var(--red); }
    .stat-sub { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

    .tabs { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; margin-bottom: 14px; }
    .tab { padding: 9px 12px; font-size: 11px; font-weight: 600; color: var(--text-muted); cursor: pointer; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; font-family: 'Inter', sans-serif; white-space: nowrap; }
    .tab.active { color: var(--navy); border-bottom-color: var(--navy); }
    .tab-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--red); color: #fff; font-size: 9px; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; margin-left: 3px; }

    .badge { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 100px; font-size: 9px; font-weight: 700; }
    .b-active { background: rgba(5,150,105,0.08); color: #059669; }
    .b-review { background: rgba(217,119,6,0.1); color: #D97706; }
    .b-kyc { background: rgba(59,130,246,0.08); color: #2563EB; }
    .b-funded { background: rgba(212,148,10,0.12); color: var(--gold); }
    .b-borrower { background: rgba(212,148,10,0.1); color: var(--gold); }
    .b-lender { background: rgba(59,130,246,0.08); color: #2563EB; }
    .b-pending { background: rgba(27,43,75,0.07); color: var(--navy); }
    .b-approved { background: rgba(5,150,105,0.08); color: #059669; }

    .a-btn { border: none; border-radius: 7px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; font-size: 11px; padding: 6px 10px; }
    .a-btn-ghost { background: none; border: 1px solid var(--border); color: var(--navy); }
    .a-btn-green { background: #059669; color: #fff; }
    .a-btn-red { background: #DC2626; color: #fff; }
    .a-btn-navy { background: var(--navy); color: #fff; }

    .overlay { position: fixed; inset: 0; background: rgba(15,27,48,0.5); z-index: 400; opacity: 0; visibility: hidden; transition: opacity 0.22s; }
    .overlay.open { opacity: 1; visibility: visible; }
    .m-sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 270px; background: #0F1B30; z-index: 500; transform: translateX(-100%); transition: transform 0.26s ease; display: flex; flex-direction: column; overflow-y: auto; }
    .m-sidebar.open { transform: translateX(0); }
    .sb-head { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; }
    .sb-logo { height: 40px; width: auto; }
    .sb-close { background: none; border: none; color: rgba(255,255,255,0.7); font-size: 22px; cursor: pointer; }
    .sb-section { padding: 16px 14px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
    .sb-item { display: flex; align-items: center; gap: 11px; padding: 11px 14px; margin: 2px 10px; border-radius: 8px; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; }
    .sb-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--gold); color: var(--navy); font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: auto; }
    .sb-bottom { margin-top: auto; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
    .sb-user { display: flex; align-items: center; gap: 11px; }
    .sb-avatar { width: 38px; height: 38px; border-radius: 50%; background: rgba(212,148,10,0.2); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #F5C842; }
    .sb-name { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.85); }
    .sb-role { font-size: 11px; color: rgba(255,255,255,0.4); }

    .q-deal-group { margin-bottom: 20px; }
    .q-deal-header { font-size: 13px; font-weight: 700; color: #1B2B4B; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .q-deal-count { background: rgba(27,43,75,0.08); color: #1B2B4B; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
    .q-card { background: #fff; border: 1px solid #E8E2D9; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
    .q-card-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 9px; flex-wrap: wrap; }
    .q-source-rule { background: rgba(212,148,10,0.12); color: #D4940A; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
    .q-source-ai { background: rgba(27,43,75,0.08); color: #1B2B4B; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
    .q-pri-high { background: rgba(220,38,38,0.08); color: #DC2626; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
    .q-pri-medium { background: rgba(212,148,10,0.1); color: #D4940A; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
    .q-pri-low { background: rgba(122,112,96,0.1); color: #7A7060; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 4px; }
    .q-metric { font-size: 10px; color: #7A7060; font-family: monospace; }
    .q-text { font-size: 13px; font-weight: 500; color: #1B2B4B; line-height: 1.55; margin-bottom: 10px; }
    .q-grounded { font-size: 11px; color: #7A7060; line-height: 1.45; margin-bottom: 10px; }
    .q-grounded strong { font-weight: 600; color: #4A4035; }
    .q-actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .q-textarea { width: 100%; min-height: 80px; padding: 10px; border: 1px solid #1B2B4B; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 13px; color: #1B2B4B; resize: vertical; margin-bottom: 8px; outline: none; box-sizing: border-box; }
    .q-empty { text-align: center; padding: 40px 20px; color: #7A7060; font-size: 13px; }
  `;

  const desktopCSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --cream: #FAF8F4; --navy: #1B2B4B; --gold: #D4940A; --border: #E8E2D9; --text-muted: #7A7060; --green: #059669; --red: #DC2626; }
    html, body { background: var(--cream); font-family: 'Inter', sans-serif; }

    .d-sidebar { position: fixed; top: 0; left: 0; width: 220px; height: 100vh; background: #0F1B30; overflow-y: auto; z-index: 200; display: flex; flex-direction: column; }
    .d-sb-head { padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); position: relative; }
    .d-sb-logo { width: 120px; height: auto; display: block; }
    .d-admin-badge { position: absolute; top: 10px; right: 10px; background: rgba(212,148,10,0.2); color: #F5C842; font-size: 9px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .d-sb-section { padding: 16px 14px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
    .d-sb-item { display: flex; align-items: center; gap: 11px; padding: 11px 14px; margin: 2px 10px; border-radius: 8px; font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); cursor: pointer; background: none; border: none; font-family: 'Inter', sans-serif; width: calc(100% - 20px); }
    .d-sb-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
    .d-sb-badge { display: inline-flex; align-items: center; justify-content: center; background: var(--gold); color: var(--navy); font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: auto; }
    .d-sb-bottom { margin-top: auto; padding: 16px; border-top: 1px solid rgba(255,255,255,0.08); }
    .d-sb-user { display: flex; align-items: center; gap: 11px; }
    .d-sb-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(212,148,10,0.2); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #F5C842; flex-shrink: 0; }
    .d-sb-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); }
    .d-sb-role { font-size: 10px; color: rgba(255,255,255,0.4); }

    .d-topbar { position: fixed; top: 0; left: 220px; right: 0; height: 60px; background: #fff; border-bottom: 1px solid var(--border); z-index: 250; display: flex; align-items: center; justify-content: space-between; padding: 0 30px; transition: transform 0.3s ease; }
    .d-topbar.hidden { transform: translateY(-100%); }
    .d-topbar-title { font-size: 16px; font-weight: 700; color: var(--navy); }
    .d-topbar-right { display: flex; align-items: center; gap: 10px; }

    .a-btn { border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
    .a-btn:hover { opacity: 0.85; }
    .a-btn-ghost { background: none; border: 1px solid var(--border); color: var(--navy); padding: 8px 14px; font-size: 12px; }
    .a-btn-navy { background: var(--navy); color: #fff; padding: 8px 14px; font-size: 12px; }
    .a-btn-green { background: #059669; color: #fff; padding: 7px 12px; font-size: 11px; }
    .a-btn-red { background: #DC2626; color: #fff; padding: 7px 12px; font-size: 11px; }

    .d-main { margin-left: 220px; padding-top: 60px; padding-left: 30px; padding-right: 30px; padding-bottom: 40px; }

    .d-alert { background: rgba(220,38,38,0.06); border: 1px solid rgba(220,38,38,0.15); border-radius: 10px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .d-alert-text { font-size: 13px; font-weight: 600; color: #DC2626; }
    .d-alert-sub { font-size: 12px; color: var(--text-muted); }

    .d-stats { display: grid; grid-template-columns: repeat(5,1fr); gap: 14px; margin-bottom: 24px; }
    .d-stat-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .d-stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 8px; }
    .d-stat-num { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 800; color: var(--navy); letter-spacing: -1px; line-height: 1; }
    .d-stat-num.gold { color: var(--gold); }
    .d-stat-num.red { color: #DC2626; }
    .d-stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 5px; }

    .d-tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
    .d-tab { padding: 10px 18px; font-size: 12px; font-weight: 600; color: var(--text-muted); cursor: pointer; border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; background: none; font-family: 'Inter', sans-serif; transition: all 0.12s; }
    .d-tab.active { color: var(--navy); border-bottom-color: var(--navy); }
    .d-tab-badge { display: inline-flex; align-items: center; justify-content: center; background: #DC2626; color: #fff; font-size: 10px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-left: 4px; }

    .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; }
    .b-active { background: rgba(5,150,105,0.08); color: #059669; }
    .b-review { background: rgba(217,119,6,0.1); color: #D97706; }
    .b-kyc { background: rgba(59,130,246,0.08); color: #2563EB; }
    .b-funded { background: rgba(212,148,10,0.12); color: var(--gold); }
    .b-borrower { background: rgba(212,148,10,0.1); color: var(--gold); }
    .b-lender { background: rgba(59,130,246,0.08); color: #2563EB; }
    .b-pending { background: rgba(27,43,75,0.07); color: var(--navy); }
    .b-approved { background: rgba(5,150,105,0.08); color: #059669; }

    .q-deal-group { margin-bottom: 24px; }
    .q-deal-header { font-size: 15px; font-weight: 700; color: #1B2B4B; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .q-deal-count { background: rgba(27,43,75,0.08); color: #1B2B4B; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
    .q-card { background: #fff; border: 1px solid #E8E2D9; border-radius: 10px; padding: 18px; margin-bottom: 10px; }
    .q-card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .q-source-rule { background: rgba(212,148,10,0.12); color: #D4940A; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
    .q-source-ai { background: rgba(27,43,75,0.08); color: #1B2B4B; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.04em; }
    .q-pri-high { background: rgba(220,38,38,0.08); color: #DC2626; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .q-pri-medium { background: rgba(212,148,10,0.1); color: #D4940A; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .q-pri-low { background: rgba(122,112,96,0.1); color: #7A7060; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .q-metric { font-size: 11px; color: #7A7060; font-family: monospace; }
    .q-text { font-size: 14px; font-weight: 500; color: #1B2B4B; line-height: 1.6; margin-bottom: 10px; }
    .q-grounded { font-size: 12px; color: #7A7060; line-height: 1.5; margin-bottom: 12px; padding: 8px 12px; background: rgba(27,43,75,0.03); border-left: 3px solid #E8E2D9; border-radius: 0 4px 4px 0; }
    .q-grounded strong { font-weight: 600; color: #4A4035; }
    .q-actions { display: flex; gap: 8px; }
    .q-textarea { width: 100%; min-height: 88px; padding: 10px 12px; border: 1px solid #1B2B4B; border-radius: 6px; font-family: 'Inter', sans-serif; font-size: 14px; color: #1B2B4B; resize: vertical; margin-bottom: 10px; outline: none; box-sizing: border-box; line-height: 1.55; }
    .q-empty { text-align: center; padding: 60px 20px; color: #7A7060; font-size: 14px; }
  `;

  // ── MOBILE LAYOUT ───────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#FAF8F4" }}>
        <style>{mobileCSS}</style>
        {dealEditModal}
        {userDetailModal}

        <div className="navbar">
          <div className="nav-left">
            <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              <span></span><span></span><span></span>
            </button>
            <span className="nav-title">Admin Panel</span>
          </div>
        </div>

        <div className={`overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)}></div>
        <div className={`m-sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sb-head">
            <img src={LOGO_NAVY} alt="Junni" className="sb-logo" />
            <button className="sb-close" onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <div className="sb-section">ADMIN</div>
          {ADMIN_NAV_ITEMS.map((item, idx) => (
            <button key={idx} className="sb-item" onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span><span>{item.text}</span>
              {item.badge && <span className="sb-badge">{item.badge}</span>}
            </button>
          ))}
          <div className="sb-section">Platform</div>
          {ADMIN_ACCOUNT_ITEMS.map((item, idx) => (
            <button key={idx} className="sb-item" onClick={() => setSidebarOpen(false)}>
              <span>{item.icon}</span><span>{item.text}</span>
            </button>
          ))}
          <div className="sb-bottom">
            <div className="sb-user">
              <div className="sb-avatar">A</div>
              <div><div className="sb-name">Admin</div><div className="sb-role">Full Access</div></div>
            </div>
          </div>
        </div>

        <div className="content">
          <div className="alert-bar">
            <p>⚠ 3 deals pending KYC review</p>
            <span>Action required before deals go live</span>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-label">Total Users</div><div className="stat-num">{usersLoading ? "—" : usersList.length}</div><div className="stat-sub">registered</div></div>
            <div className="stat-card"><div className="stat-label">Active Deals</div><div className="stat-num gold">{dealsLoading ? "—" : dealsList.length}</div><div className="stat-sub">on platform</div></div>
            <div className="stat-card"><div className="stat-label">Capital Deployed</div><div className="stat-num">$450M</div><div className="stat-sub">all time</div></div>
            <div className="stat-card"><div className="stat-label">KYC Pending</div><div className="stat-num red">3</div><div className="stat-sub">needs review</div></div>
            <div className="stat-card"><div className="stat-label">Platform Fee</div><div className="stat-num">2.5%</div><div className="stat-sub">per deal</div></div>
          </div>
          <div>
            <div className="tabs">
              <button className={`tab ${activeTab === 0 ? "active" : ""}`} onClick={() => setActiveTab(0)}>
                Questions{questions.length > 0 && <span className="tab-badge">{questions.length}</span>}
              </button>
              <button className={`tab ${activeTab === 1 ? "active" : ""}`} onClick={() => setActiveTab(1)}>Deals</button>
              <button className={`tab ${activeTab === 2 ? "active" : ""}`} onClick={() => setActiveTab(2)}>Users</button>
              <button className={`tab ${activeTab === 3 ? "active" : ""}`} onClick={() => setActiveTab(3)}>KYC <span className="tab-badge">3</span></button>
              <button className={`tab ${activeTab === 4 ? "active" : ""}`} onClick={() => setActiveTab(4)}>Bids</button>
            </div>
            {renderTabContent(true)}
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#FAF8F4" }}>
      <style>{desktopCSS}</style>
      {dealEditModal}
      {userDetailModal}

      <div className="d-sidebar">
        <div className="d-sb-head">
          <img src={LOGO_NAVY} alt="Junni" className="d-sb-logo" />
          <span className="d-admin-badge">Admin</span>
        </div>
        <div className="d-sb-section">Management</div>
        {ADMIN_NAV_ITEMS.map((item, idx) => (
          <button key={idx} className="d-sb-item">
            <span>{item.icon}</span>{item.text}
            {item.badge && <span className="d-sb-badge">{item.badge}</span>}
          </button>
        ))}
        <div className="d-sb-section">Platform</div>
        {ADMIN_ACCOUNT_ITEMS.map((item, idx) => (
          <button key={idx} className="d-sb-item">
            <span>{item.icon}</span>{item.text}
          </button>
        ))}
        <div className="d-sb-bottom">
          <div className="d-sb-user">
            <div className="d-sb-avatar">A</div>
            <div><div className="d-sb-name">Admin</div><div className="d-sb-role">Full Access</div></div>
          </div>
        </div>
      </div>

      <div className={`d-topbar ${!topbarVisible ? "hidden" : ""}`}>
        <div className="d-topbar-title">Admin Panel</div>
        <div className="d-topbar-right">
          <button className="a-btn a-btn-ghost" onClick={() => alert("Export Data")}>Export Data</button>
          <button className="a-btn a-btn-navy" onClick={() => alert("Platform Settings")}>Platform Settings</button>
        </div>
      </div>

      <div className="d-main">
        <div className="d-alert">
          <div><div className="d-alert-text">⚠ 3 deals pending KYC review</div><div className="d-alert-sub">Action required before deals go live</div></div>
          <button className="a-btn a-btn-ghost" onClick={() => setActiveTab(3)}>Review Now</button>
        </div>

        <div className="d-stats">
          <div className="d-stat-card"><div className="d-stat-label">Total Users</div><div className="d-stat-num">{usersLoading ? "—" : usersList.length}</div><div className="d-stat-sub">registered</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Total Deals</div><div className="d-stat-num gold">{dealsLoading ? "—" : dealsList.length}</div><div className="d-stat-sub">on platform</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Capital Deployed</div><div className="d-stat-num">$450M</div><div className="d-stat-sub">all time</div></div>
          <div className="d-stat-card"><div className="d-stat-label">KYC Pending</div><div className="d-stat-num red">3</div><div className="d-stat-sub">needs review</div></div>
          <div className="d-stat-card"><div className="d-stat-label">Platform Fee</div><div className="d-stat-num">2.5%</div><div className="d-stat-sub">per deal</div></div>
        </div>

        <div className="d-tabs">
          <button className={`d-tab ${activeTab === 0 ? "active" : ""}`} onClick={() => setActiveTab(0)}>
            Questions{questions.length > 0 && <span className="d-tab-badge">{questions.length}</span>}
          </button>
          <button className={`d-tab ${activeTab === 1 ? "active" : ""}`} onClick={() => setActiveTab(1)}>
            Deals{!dealsLoading && dealsList.length > 0 && <span className="d-tab-badge" style={{ background: "#1B2B4B" }}>{dealsList.length}</span>}
          </button>
          <button className={`d-tab ${activeTab === 2 ? "active" : ""}`} onClick={() => setActiveTab(2)}>
            Users{!usersLoading && usersList.length > 0 && <span className="d-tab-badge" style={{ background: "#1B2B4B" }}>{usersList.length}</span>}
          </button>
          <button className={`d-tab ${activeTab === 3 ? "active" : ""}`} onClick={() => setActiveTab(3)}>KYC Review <span className="d-tab-badge">3</span></button>
          <button className={`d-tab ${activeTab === 4 ? "active" : ""}`} onClick={() => setActiveTab(4)}>Bids</button>
        </div>

        {renderTabContent(false)}
      </div>
    </div>
  );
}
