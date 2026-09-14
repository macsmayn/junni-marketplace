import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { supabase } from '../lib/supabase';
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageToggle } from "../components/LanguageToggle";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'live' | 'in_progress' | 'waiting' | 'planned' | 'deferred' | 'risk';
type InvStatus = 'queued' | 'sent' | 'replied' | 'meeting' | 'term' | 'declined' | 'dropped';

interface FounderItem {
  id: string;
  area: string;
  sort_order: number;
  name: string;
  status: ItemStatus;
  note: string | null;
  waiting_on: string | null;
  waiting_since: string | null;
  due_on: string | null;
  needs_confirm: boolean;
}

interface InvestorRow {
  id: string;
  entity: string;
  contacted_on: string | null;
  what_sent: string | null;
  route: string | null;
  answer: string | null;
  status: InvStatus;
}

interface LiveCounts {
  orgsTotal: number;
  orgsLast30: number;
  dealsTotal: number;
  dealsLast30: number;
  scoresTotal: number;
  costTotal: number;
  costAvg: number;
  tokensTotal: number;
  subsByStatus: Record<string, number>;
  subsByPlan: Record<string, number>;
  retentionLog: Array<{ org_name: string | null; warning_30d_sent_at: string | null; warning_14d_sent_at: string | null; deleted_at: string | null }>;
  dealsPerWeek: Array<{ week: string; count: number }>;
}

// ── Hardcoded data ────────────────────────────────────────────────────────────

const LAUNCH_DATE = '2026-10-04';

const CHAIN_STEPS: Array<{ label: string; sub: string; nameMatch: string }> = [
  { label: 'Incorporated',           sub: '21 Aug',        nameMatch: 'Federal incorporation' },
  { label: 'NEQ received',           sub: 'NEQ',           nameMatch: 'Quebec registration (NEQ)' },
  { label: 'GST/QST registered',     sub: 'GST/QST',       nameMatch: 'GST/QST registration' },
  { label: 'Bank account',           sub: 'National Bank', nameMatch: 'Business bank account, National Bank' },
  { label: 'Stripe live',            sub: 'needs bank',    nameMatch: 'Stripe live activation' },
  { label: 'Live catalogue + price IDs', sub: 'SQL update', nameMatch: 'Update billing_plans with live price IDs' },
  { label: 'Stripe Tax on',          sub: 'registered',    nameMatch: 'Turn Stripe Tax on' },
  { label: 'Delete test data',       sub: 'one pass',      nameMatch: 'Delete test data' },
  { label: 'Open signup',            sub: 'Auth0 switch',  nameMatch: 'Re-enable Auth0 self-service signup' },
  { label: 'Launch 4 Oct',           sub: 'signup opens',  nameMatch: 'Launch: open signup on 4 October' },
];

const TIMELINE = [
  { d: '2 May 2026',        t: 'Futurpreneur and FACE applications submitted',   b: 'Marketplace model. Business plan and 3-statement model built.', future: false, pivot: false },
  { d: '13 May 2026',       t: 'Marketplace MVP built on Manus',                 b: '18 pages, EN/FR, 750-metric scoring database (50 metrics across 15 industries).', future: false, pivot: false },
  { d: '27 May – 6 June',   t: 'Site redesigned, Auth0 integrated, Supabase started', b: 'Anthropic API chosen for scoring. Prototype moves from demo to real backend.', future: false, pivot: false },
  { d: '12 June 2026',      t: 'AMF fintech form submitted; law firms quoted',   b: 'Norton Rose $45–65K; BCF $10–15K for Phase 1. Self-funding decided.', future: false, pivot: false },
  { d: '24 June 2026',      t: 'Pivot: AI credit-analysis infrastructure for private lenders', b: 'Marketplace demoted to one vision line. Beachhead: alt lenders, MCA originators, small debt funds.', future: false, pivot: true },
  { d: 'July 2026',         t: 'Scoring framework and engine built',             b: 'Industry thresholds, importance tiers, combination logic, edge functions, SBA and CSBFP benchmark tables.', future: false, pivot: false },
  { d: '20–22 Aug 2026',    t: 'Incorporated; first investor outreach',          b: 'Junni Technologies Inc., certificate received 24 Aug. 41 funds and angel groups contacted in three days.', future: false, pivot: false },
  { d: 'Aug 2026',          t: 'Database moved to Canada; French translation complete', b: 'ca-central-1 migration, 0 failures. Security fixes shipped.', future: false, pivot: false },
  { d: 'Aug–Sept 2026',     t: 'Billing, teams, marketing site, per-lender configuration', b: 'Stripe sandbox, multi-org, junni.ca rebuilt, thresholds, tiers, what-if, history.', future: false, pivot: false },
  { d: '6 Sept 2026',       t: 'LinkedIn authority plan',                        b: 'Publishing suspended until resignation; content bank due 1 December.', future: false, pivot: false },
  { d: '9–11 Sept 2026',    t: 'PME MTL becomes a client; NEQ; GST number; ZDR and cousin requests sent', b: 'Bank account manager reached 11 Sept.', future: false, pivot: false },
  { d: '13 Sept 2026',      t: 'Law 25 documents, legal pages rewritten, retention automated', b: 'Four compliance documents delivered. Cron job live in warn mode.', future: false, pivot: false },
  { d: 'Week of 14 Sept',   t: 'Luge Capital meeting; bank opens; QST number; PME MTL plan due', b: 'The busiest week since incorporation.', future: true, pivot: false },
  { d: '4 Oct 2026',        t: 'Launch: signup opens',                           b: 'Symbolic date. Quiet launch, no public announcement until resignation.', future: true, pivot: false },
  { d: '1 Dec 2026',        t: 'Content bank complete',                          b: '40 posts, 10 charts, launch sequence ready.', future: true, pivot: false },
  { d: '31 Dec 2026',       t: 'Fiscal year end; resignation target',            b: 'LOIs and investor money follow resignation.', future: true, pivot: false },
];

const CAL_MONTHS: Array<[number, number]> = [[2026, 8], [2026, 9], [2026, 10], [2026, 11]];

const INV_STATUS_ORDER: InvStatus[] = ['queued', 'sent', 'replied', 'meeting', 'term', 'declined', 'dropped'];

const PIE_COLORS: Record<InvStatus, string> = {
  queued: '#8A93A3', sent: '#4C6A99', replied: '#D4940A', meeting: '#F0C56A',
  term: '#1F7A55', declined: '#B4432E', dropped: '#B9AE9C',
};

const STATUS_CSS: Record<ItemStatus, { bg: string; color: string }> = {
  live:        { bg: '#E4F3EC', color: '#1F7A55' },
  in_progress: { bg: '#FBF0D6', color: '#B57F08' },
  waiting:     { bg: '#E6ECF5', color: '#4C6A99' },
  planned:     { bg: '#EFF0F2', color: '#5B6472' },
  deferred:    { bg: '#F3F0EA', color: '#7C7262' },
  risk:        { bg: '#F8E6E2', color: '#B4432E' },
};

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  :root {
    --cream: #FAF8F4; --navy: #1B2B4B; --navy-deep: #14213A; --navy-soft: #2F4470;
    --gold: #D4940A; --gold-dark: #B57F08; --gold-light: #F0C56A; --gold-wash: #FBF3E1;
    --paper: #FFFFFF; --line: #E8E2D9; --line-strong: #D9D1C5;
    --ink: #1B2B4B; --ink-2: #4B5568; --ink-3: #8A93A3;
    --live: #1F7A55; --live-wash: #E4F3EC;
    --risk-color: #B4432E; --risk-wash: #F8E6E2;
    --wait: #4C6A99; --wait-wash: #E6ECF5;
  }
  .fd-wrap { background: var(--cream); min-height: 100vh; font-family: Inter, system-ui, sans-serif; font-size: 14px; color: var(--ink); }
  .fd-topbar { background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; height: 54px; position: sticky; top: 0; z-index: 10; }
  .fd-topbar-left { display: flex; align-items: center; gap: 12px; }
  .fd-back { background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 13px; padding: 6px 10px; border-radius: 6px; font-family: Inter, sans-serif; }
  .fd-back:hover { background: rgba(255,255,255,0.08); color: #fff; }
  .fd-topbar-title { font-family: Fraunces, Georgia, serif; font-weight: 700; font-size: 18px; color: var(--gold-light); }
  .fd-main { max-width: 1300px; margin: 0 auto; padding: 24px 20px 60px; }
  .fd-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 24px; border-bottom: 2px solid var(--line); padding-bottom: 0; }
  .fd-tab { background: none; border: none; padding: 10px 16px; font-size: 13px; font-weight: 500; color: var(--ink-2); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: Inter, sans-serif; }
  .fd-tab.active { color: var(--navy); border-bottom-color: var(--gold); font-weight: 600; }
  .fd-tab:hover:not(.active) { color: var(--ink); }
  .fd-section { margin-bottom: 24px; }
  .fd-grid { display: grid; gap: 14px; }
  .fd-g2 { grid-template-columns: 1fr 1fr; }
  .fd-g3 { grid-template-columns: 1fr 1fr 1fr; }
  .fd-g4 { grid-template-columns: repeat(4, 1fr); }
  .fd-g5 { grid-template-columns: repeat(5, 1fr); }
  .fd-g6 { grid-template-columns: repeat(6, 1fr); }
  .fd-card { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; }
  .fd-card h2 { font-family: Fraunces, Georgia, serif; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
  .fd-card h3 { font-family: Fraunces, Georgia, serif; font-size: 15px; font-weight: 700; margin-bottom: 10px; }
  .fd-kpi { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; }
  .fd-kpi.gold { background: var(--navy); border-color: var(--navy); }
  .fd-kpi .v { font-family: Fraunces, Georgia, serif; font-weight: 700; font-size: 28px; line-height: 1; color: var(--navy); }
  .fd-kpi.gold .v { color: var(--gold-light); }
  .fd-kpi .l { font-size: 12px; color: var(--ink-2); margin-top: 5px; }
  .fd-kpi.gold .l { color: #D7DDE8; }
  .fd-kpi .d { font-size: 11px; color: var(--ink-3); margin-top: 2px; }
  .fd-kpi.gold .d { color: #93A0B8; }
  .chain-wrap { background: var(--navy); border-radius: 16px; padding: 22px 24px 18px; color: #fff; }
  .chain-wrap h3 { font-family: Fraunces, Georgia, serif; font-size: 18px; color: #fff; margin-bottom: 3px; }
  .chain-wrap p { font-size: 12px; color: #B9C3D6; margin-bottom: 16px; }
  .chain-track { display: flex; align-items: stretch; overflow-x: auto; padding-bottom: 4px; }
  .chain-gate { flex: 1 1 0; min-width: 100px; position: relative; padding: 0 5px; }
  .chain-gate::before { content: ""; position: absolute; top: 16px; left: -50%; width: 100%; height: 2px; background: rgba(255,255,255,0.15); }
  .chain-gate:first-child::before { display: none; }
  .chain-gate.done::before, .chain-gate.doing::before { background: var(--gold); }
  .chain-dot { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin: 0 auto 8px; border: 2px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.06); position: relative; z-index: 1; }
  .chain-gate.done .chain-dot { background: var(--gold); border-color: var(--gold); color: var(--navy); }
  .chain-gate.doing .chain-dot { background: var(--gold-wash); border-color: var(--gold-light); color: var(--navy); box-shadow: 0 0 0 5px rgba(240,197,106,0.15); }
  .chain-gate.next .chain-dot { border-color: rgba(255,255,255,0.5); }
  .chain-label { font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.3; }
  .chain-sub { font-size: 10.5px; color: #B9C3D6; text-align: center; margin-top: 2px; }
  .chain-gate.doing .chain-label { color: var(--gold-light); }
  .ws-row { display: grid; grid-template-columns: 160px 1fr 48px; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); }
  .ws-row:last-child { border-bottom: 0; }
  .ws-name { font-weight: 500; font-size: 12.5px; }
  .ws-bar { height: 8px; background: var(--line); border-radius: 999px; overflow: hidden; display: flex; }
  .ws-bar-live { background: var(--live); height: 100%; border-radius: 999px 0 0 999px; }
  .ws-bar-doing { background: var(--gold); height: 100%; }
  .ws-pct { font-size: 12px; font-weight: 600; text-align: right; }
  .wait-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); }
  .wait-row:last-child { border-bottom: 0; }
  .wait-name { font-weight: 500; font-size: 13px; }
  .wait-who { font-size: 11.5px; color: var(--ink-2); margin-top: 2px; }
  .wait-days { font-family: Fraunces, Georgia, serif; font-weight: 700; font-size: 20px; color: var(--wait); text-align: right; line-height: 1; }
  .wait-days-sub { display: block; font-family: Inter, sans-serif; font-weight: 500; font-size: 11px; color: var(--ink-3); }
  .fd-chip { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  .fd-chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .fd-filters { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
  .fd-filter-btn { border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 500; color: var(--ink-2); background: var(--paper); cursor: pointer; font-family: Inter, sans-serif; }
  .fd-filter-btn.active { background: var(--navy); color: #fff; border-color: var(--navy); }
  .fd-area-head { display: flex; align-items: center; justify-content: space-between; margin: 20px 0 8px; }
  .fd-area-head h3 { margin: 0; }
  .fd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .fd-table th { text-align: left; font-weight: 600; color: var(--ink-3); font-size: 11px; padding: 5px 7px; border-bottom: 1px solid var(--line); }
  .fd-table td { padding: 7px 7px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  .fd-table tr:last-child td { border-bottom: 0; }
  .fd-input { font: inherit; font-size: 12px; border: 1px solid transparent; border-radius: 5px; padding: 3px 6px; background: transparent; color: var(--ink); width: 100%; box-sizing: border-box; }
  .fd-input:focus { outline: none; border-color: var(--gold); background: var(--gold-wash); }
  .fd-select { font: inherit; font-size: 12px; border: 1px solid var(--line); border-radius: 5px; padding: 3px 6px; background: var(--paper); color: var(--ink); }
  .fd-del-btn { background: none; border: none; color: var(--ink-3); font-size: 16px; cursor: pointer; padding: 2px 5px; line-height: 1; }
  .fd-del-btn:hover { color: var(--risk-color); }
  .fd-add-btn { background: var(--navy); color: #fff; border: none; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: Inter, sans-serif; }
  .fd-add-btn:hover { background: var(--navy-soft); }
  .fd-ghost-btn { background: var(--paper); color: var(--navy); border: 1px solid var(--line-strong); border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: Inter, sans-serif; }
  .fd-ghost-btn:hover { background: var(--cream); }
  .fd-saved { font-size: 11px; color: var(--live); font-weight: 600; }
  .fd-failed { font-size: 11px; color: var(--risk-color); font-weight: 600; }
  .fd-fact { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
  .fd-fact:last-child { border-bottom: 0; }
  .fd-fact b { font-weight: 600; }
  .tl-wrap { position: relative; padding-left: 22px; }
  .tl-wrap::before { content: ""; position: absolute; left: 6px; top: 6px; bottom: 6px; width: 2px; background: var(--line-strong); }
  .tl-ev { position: relative; padding: 0 0 16px 14px; }
  .tl-ev::before { content: ""; position: absolute; left: -20px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--gold); border: 2px solid var(--paper); box-shadow: 0 0 0 2px var(--gold); }
  .tl-ev.future::before { background: var(--paper); box-shadow: 0 0 0 2px var(--wait); }
  .tl-ev.pivot::before { background: var(--navy); box-shadow: 0 0 0 2px var(--navy); }
  .tl-date { font-size: 11px; color: var(--ink-3); font-weight: 600; }
  .tl-title { font-weight: 600; font-size: 13.5px; margin: 1px 0; }
  .tl-body { font-size: 12.5px; color: var(--ink-2); }
  .cal-months { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
  .cal-month-btn { border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; font-size: 12px; background: var(--paper); cursor: pointer; font-family: Inter, sans-serif; }
  .cal-month-btn.active { background: var(--navy); color: #fff; border-color: var(--navy); }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .cal-hdr { font-size: 11px; color: var(--ink-3); font-weight: 600; text-align: center; padding: 4px 0; }
  .cal-cell { min-height: 52px; border: 1px solid var(--line); border-radius: 5px; padding: 3px 4px; font-size: 11px; color: var(--ink-3); background: var(--paper); }
  .cal-cell.pad { background: transparent; border-color: transparent; }
  .cal-cell.today { border-color: var(--gold); box-shadow: inset 0 0 0 1px var(--gold); }
  .cal-event { display: block; margin-top: 2px; background: var(--gold-wash); color: var(--gold-dark); border-radius: 3px; padding: 1px 3px; font-size: 10px; font-weight: 600; line-height: 1.3; word-break: break-word; }
  .fd-muted { color: var(--ink-3); }
  .fd-small { font-size: 12px; }
  .fd-loading { color: var(--ink-2); padding: 40px 0; text-align: center; }
  .fd-error { color: var(--risk-color); padding: 20px 0; }
  @media (max-width: 900px) {
    .fd-g2, .fd-g3, .fd-g4, .fd-g5, .fd-g6 { grid-template-columns: 1fr 1fr; }
    .fd-main { padding: 16px 14px 50px; }
    .fd-table { display: block; overflow-x: auto; }
    .ws-row { grid-template-columns: 120px 1fr 40px; }
  }
  @media (max-width: 520px) {
    .fd-g2, .fd-g3, .fd-g4, .fd-g5, .fd-g6 { grid-template-columns: 1fr; }
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s + 'T12:00:00').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pct(n: number, d: number): number {
  return d ? Math.round(100 * n / d) : 0;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const content = rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
  a.download = filename;
  a.click();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FounderDashboard() {
  const [, setLocation] = useLocation();
  const { t, lang } = useLanguage();
  const [activeTab, setActiveTab] = useState(0);

  // Data state
  const [items, setItems] = useState<FounderItem[]>([]);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [liveCounts, setLiveCounts] = useState<LiveCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Items tab UI state
  const [itemFilter, setItemFilter] = useState<string>('all');
  const [itemSaveState, setItemSaveState] = useState<Record<string, 'saved' | 'failed'>>({});

  // Investor tab UI state
  const [invFilter, setInvFilter] = useState<string>('all');
  const [invSaveState, setInvSaveState] = useState<Record<string, 'saved' | 'failed'>>({});

  // Calendar state
  const [calMonth, setCalMonth] = useState(0);

  const todayStr = today();

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [itemsRes, invRes, orgsRes, dealsRes, scoresRes, subsRes, retRes] = await Promise.all([
        supabase.from('founder_dashboard_items').select('*').order('area').order('sort_order'),
        supabase.from('investor_pipeline').select('*').order('contacted_on', { ascending: false }),
        supabase.from('organizations').select('id,created_at'),
        supabase.from('deals').select('id,created_at'),
        supabase.from('credit_scores').select('api_cost_cad,input_tokens,output_tokens'),
        supabase.from('subscriptions').select('status,plan_key'),
        supabase.from('data_retention_log').select('org_name,warning_30d_sent_at,warning_14d_sent_at,deleted_at').order('id', { ascending: false }).limit(20),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (invRes.error) throw invRes.error;

      setItems((itemsRes.data as FounderItem[]) ?? []);
      setInvestors((invRes.data as InvestorRow[]) ?? []);

      // Live counts
      const orgs = orgsRes.data ?? [];
      const deals = dealsRes.data ?? [];
      const scores = scoresRes.data ?? [];
      const subs = subsRes.data ?? [];
      const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();

      const subsByStatus: Record<string, number> = {};
      const subsByPlan: Record<string, number> = {};
      for (const s of subs) {
        subsByStatus[s.status] = (subsByStatus[s.status] ?? 0) + 1;
        if (s.plan_key) subsByPlan[s.plan_key] = (subsByPlan[s.plan_key] ?? 0) + 1;
      }

      // Deals per week (last 12 weeks)
      const dealsPerWeek: Array<{ week: string; count: number }> = [];
      const weekMap: Record<string, number> = {};
      const now = Date.now();
      for (const d of deals) {
        if (!d.created_at) continue;
        const ts = new Date(d.created_at).getTime();
        const weeksAgo = Math.floor((now - ts) / (7 * 86400000));
        if (weeksAgo >= 12) continue;
        const weekStart = new Date(now - weeksAgo * 7 * 86400000);
        weekStart.setUTCHours(0, 0, 0, 0);
        const dayOfWeek = weekStart.getUTCDay();
        weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
        const key = weekStart.toISOString().slice(0, 10);
        weekMap[key] = (weekMap[key] ?? 0) + 1;
      }
      const sortedWeeks = Object.keys(weekMap).sort();
      for (const w of sortedWeeks) dealsPerWeek.push({ week: w, count: weekMap[w] });

      const costTotal = scores.reduce((s, r) => s + (Number(r.api_cost_cad) || 0), 0);
      const tokensTotal = scores.reduce((s, r) => s + (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0), 0);

      setLiveCounts({
        orgsTotal: orgs.length,
        orgsLast30: orgs.filter(o => o.created_at && o.created_at >= cutoff30).length,
        dealsTotal: deals.length,
        dealsLast30: deals.filter(d => d.created_at && d.created_at >= cutoff30).length,
        scoresTotal: scores.length,
        costTotal,
        costAvg: scores.length ? costTotal / scores.length : 0,
        tokensTotal,
        subsByStatus,
        subsByPlan,
        retentionLog: retRes.data ?? [],
        dealsPerWeek,
      });
    } catch (e: unknown) {
      setLoadError(t('adminPanel.founderDashboard.loadError'));
      console.error('FounderDashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Item updates ───────────────────────────────────────────────────────────

  async function updateItem(id: string, field: keyof FounderItem, value: unknown, oldValue: unknown) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
    const { error } = await supabase.from('founder_dashboard_items').update({ [field]: value }).eq('id', id);
    if (error) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: oldValue } : it));
      setItemSaveState(s => ({ ...s, [id]: 'failed' }));
    } else {
      setItemSaveState(s => ({ ...s, [id]: 'saved' }));
    }
    setTimeout(() => setItemSaveState(s => { const n = { ...s }; delete n[id]; return n; }), 2000);
  }

  async function addItem(area: string) {
    const { data, error } = await supabase.from('founder_dashboard_items')
      .insert({ area, status: 'planned', name: 'New item', sort_order: 999 })
      .select()
      .single();
    if (!error && data) setItems(prev => [...prev, data as FounderItem]);
  }

  async function deleteItem(id: string) {
    if (!window.confirm(t('adminPanel.founderDashboard.confirmDeleteItem'))) return;
    const { error } = await supabase.from('founder_dashboard_items').delete().eq('id', id);
    if (!error) setItems(prev => prev.filter(it => it.id !== id));
  }

  // ── Investor updates ───────────────────────────────────────────────────────

  async function updateInvestor(id: string, field: keyof InvestorRow, value: unknown, oldValue: unknown) {
    setInvestors(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    const { error } = await supabase.from('investor_pipeline').update({ [field]: value }).eq('id', id);
    if (error) {
      setInvestors(prev => prev.map(r => r.id === id ? { ...r, [field]: oldValue } : r));
      setInvSaveState(s => ({ ...s, [id]: 'failed' }));
    } else {
      setInvSaveState(s => ({ ...s, [id]: 'saved' }));
    }
    setTimeout(() => setInvSaveState(s => { const n = { ...s }; delete n[id]; return n; }), 2000);
  }

  async function addInvestor() {
    const { data, error } = await supabase.from('investor_pipeline')
      .insert({ entity: 'New investor', status: 'queued', contacted_on: todayStr })
      .select()
      .single();
    if (!error && data) setInvestors(prev => [data as InvestorRow, ...prev]);
  }

  async function deleteInvestor(id: string, name: string) {
    if (!window.confirm(t('adminPanel.founderDashboard.confirmDeleteInvestor') + ' ' + name)) return;
    const { error } = await supabase.from('investor_pipeline').delete().eq('id', id);
    if (!error) setInvestors(prev => prev.filter(r => r.id !== id));
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const statusLabel = (s: ItemStatus): string => {
    const map: Record<ItemStatus, string> = {
      live: t('adminPanel.founderDashboard.statusLive'),
      in_progress: t('adminPanel.founderDashboard.statusInProgress'),
      waiting: t('adminPanel.founderDashboard.statusWaiting'),
      planned: t('adminPanel.founderDashboard.statusPlanned'),
      deferred: t('adminPanel.founderDashboard.statusDeferred'),
      risk: t('adminPanel.founderDashboard.statusRisk'),
    };
    return map[s] ?? s;
  };

  const invStatusLabel = (s: InvStatus): string => {
    const map: Record<InvStatus, string> = {
      queued: t('adminPanel.founderDashboard.investorStatusQueued'),
      sent: t('adminPanel.founderDashboard.investorStatusSent'),
      replied: t('adminPanel.founderDashboard.investorStatusReplied'),
      meeting: t('adminPanel.founderDashboard.investorStatusMeeting'),
      term: t('adminPanel.founderDashboard.investorStatusTerm'),
      declined: t('adminPanel.founderDashboard.investorStatusDeclined'),
      dropped: t('adminPanel.founderDashboard.investorStatusDropped'),
    };
    return map[s] ?? s;
  };

  // Chain state: derive from items by name match
  function chainGateState(nameMatch: string): 'done' | 'doing' | 'next' {
    const item = items.find(it => it.name.includes(nameMatch) || nameMatch.includes(it.name.slice(0, 20)));
    if (!item) return 'next';
    if (item.status === 'live') return 'done';
    if (item.status === 'in_progress' || item.status === 'waiting') return 'doing';
    return 'next';
  }

  // ── Tab renderers ──────────────────────────────────────────────────────────

  function renderOverview() {
    const total = items.length;
    const liveDone = items.filter(it => it.status === 'live').length;
    const waiting = items.filter(it => it.status === 'waiting');
    const risks = items.filter(it => it.status === 'risk');
    const contacted = investors.filter(r => r.status !== 'queued' && r.status !== 'dropped').length;
    const replies = investors.filter(r => ['replied', 'meeting', 'term', 'declined'].includes(r.status)).length;
    const avgCost = liveCounts?.costAvg ?? 0;
    const daysLeft = daysBetween(todayStr, LAUNCH_DATE);
    const areas = [...new Set(items.map(it => it.area))];

    return (
      <div>
        {/* KPI row */}
        <div className="fd-grid fd-g6 fd-section">
          <div className="fd-kpi gold">
            <div className="v">{daysLeft}<small style={{ fontSize: 14, fontFamily: 'Inter,sans-serif', fontWeight: 500 }}> {t('adminPanel.founderDashboard.daysLabel')}</small></div>
            <div className="l">{t('adminPanel.founderDashboard.daysToLaunch')}</div>
            <div className="d">{waiting.length} {t('adminPanel.founderDashboard.waitingCount').toLowerCase()}</div>
          </div>
          <div className="fd-kpi">
            <div className="v">{pct(liveDone, total)}<small style={{ fontSize: 14, fontFamily: 'Inter,sans-serif' }}>%</small></div>
            <div className="l">{t('adminPanel.founderDashboard.pctLive')}</div>
            <div className="d">{liveDone} / {total}</div>
          </div>
          <div className="fd-kpi">
            <div className="v">{contacted}</div>
            <div className="l">{t('adminPanel.founderDashboard.investorsContacted')}</div>
            <div className="d">{investors.length} tracked</div>
          </div>
          <div className="fd-kpi">
            <div className="v">{replies}</div>
            <div className="l">{t('adminPanel.founderDashboard.investorReplies')}</div>
            <div className="d">{contacted ? Math.round(100 * replies / contacted) : 0}% reply rate</div>
          </div>
          <div className="fd-kpi">
            <div className="v">${avgCost.toFixed(2)}</div>
            <div className="l">{t('adminPanel.founderDashboard.avgApiCost')}</div>
            <div className="d">{liveCounts?.scoresTotal ?? 0} deals scored</div>
          </div>
        </div>

        {/* Launch chain */}
        <div className="fd-section chain-wrap">
          <h3>{t('adminPanel.founderDashboard.launchChainTitle')}</h3>
          <p>{t('adminPanel.founderDashboard.launchChainDesc')}</p>
          <div className="chain-track">
            {CHAIN_STEPS.map((step, i) => {
              const state = chainGateState(step.nameMatch);
              return (
                <div key={i} className={`chain-gate ${state}`}>
                  <div className="chain-dot">{state === 'done' ? '✓' : i + 1}</div>
                  <div className="chain-label">{step.label}</div>
                  <div className="chain-sub">{step.sub}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion + waiting + risks */}
        <div className="fd-grid fd-g3 fd-section">
          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.completionByArea')}</h3>
            {areas.map(area => {
              const areaItems = items.filter(it => it.area === area);
              const livePct = pct(areaItems.filter(it => it.status === 'live').length, areaItems.length);
              const doingPct = pct(areaItems.filter(it => it.status === 'in_progress').length, areaItems.length);
              return (
                <div key={area} className="ws-row">
                  <div className="ws-name">{area}</div>
                  <div className="ws-bar">
                    <div className="ws-bar-live" style={{ width: livePct + '%' }} />
                    <div className="ws-bar-doing" style={{ width: doingPct + '%' }} />
                  </div>
                  <div className="ws-pct">{livePct}%</div>
                </div>
              );
            })}
          </div>

          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.waitingOnOthers')}</h3>
            {waiting.length === 0 && <p className="fd-muted fd-small">{t('adminPanel.founderDashboard.noWaiting')}</p>}
            {waiting.map(it => {
              const days = it.waiting_since ? daysBetween(it.waiting_since, todayStr) : null;
              return (
                <div key={it.id} className="wait-row">
                  <div>
                    <div className="wait-name">{it.name}</div>
                    {it.waiting_on && <div className="wait-who">{it.waiting_on}</div>}
                  </div>
                  <div className="wait-days">
                    {days !== null ? days : '?'}
                    <span className="wait-days-sub">
                      {days !== null && it.waiting_since
                        ? `${t('adminPanel.founderDashboard.daysSince')} ${fmtDate(it.waiting_since)}`
                        : t('adminPanel.founderDashboard.daysLabel')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.riskItems')}</h3>
            {risks.length === 0 && <p className="fd-muted fd-small">{t('adminPanel.founderDashboard.noRisks')}</p>}
            {risks.map(it => (
              <div key={it.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontWeight: 500 }}>{it.name}</div>
                {it.note && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{it.note}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderItems() {
    const areas = [...new Set(items.map(it => it.area))];
    const STATUSES: ItemStatus[] = ['live', 'in_progress', 'waiting', 'planned', 'deferred', 'risk'];
    const filtered = itemFilter === 'all' ? items : items.filter(it => it.status === itemFilter);

    return (
      <div>
        <div className="fd-filters">
          <button className={`fd-filter-btn ${itemFilter === 'all' ? 'active' : ''}`} onClick={() => setItemFilter('all')}>
            {t('adminPanel.founderDashboard.filterAll')} {items.length}
          </button>
          {STATUSES.map(s => {
            const count = items.filter(it => it.status === s).length;
            return (
              <button key={s} className={`fd-filter-btn ${itemFilter === s ? 'active' : ''}`} onClick={() => setItemFilter(s)}>
                {statusLabel(s)} {count}
              </button>
            );
          })}
        </div>

        {areas.map(area => {
          const areaFiltered = filtered.filter(it => it.area === area);
          if (areaFiltered.length === 0) return null;
          return (
            <div key={area}>
              <div className="fd-area-head">
                <h3 style={{ fontFamily: 'Fraunces,Georgia,serif', fontWeight: 700, fontSize: 15 }}>{area}</h3>
                <button className="fd-add-btn" onClick={() => addItem(area)}>{t('adminPanel.founderDashboard.addItem')}</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="fd-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 200 }}>{t('adminPanel.founderDashboard.colName')}</th>
                      <th>{t('adminPanel.founderDashboard.colStatus')}</th>
                      <th style={{ minWidth: 200 }}>{t('adminPanel.founderDashboard.colNote')}</th>
                      <th style={{ minWidth: 150 }}>{t('adminPanel.founderDashboard.colWaitingOn')}</th>
                      <th>{t('adminPanel.founderDashboard.colWaitingSince')}</th>
                      <th>{t('adminPanel.founderDashboard.colDueOn')}</th>
                      <th>{t('adminPanel.founderDashboard.colNeedsConfirm')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaFiltered.map(it => {
                      const css = STATUS_CSS[it.status];
                      const saveS = itemSaveState[it.id];
                      return (
                        <tr key={it.id}>
                          <td>
                            <input
                              className="fd-input"
                              defaultValue={it.name}
                              onBlur={e => { const v = e.target.value; if (v !== it.name) updateItem(it.id, 'name', v, it.name); }}
                            />
                          </td>
                          <td>
                            <select
                              className="fd-select"
                              value={it.status}
                              onChange={e => updateItem(it.id, 'status', e.target.value, it.status)}
                              style={{ background: css.bg, color: css.color, borderColor: css.bg }}
                            >
                              {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                            </select>
                          </td>
                          <td>
                            <input className="fd-input" defaultValue={it.note ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== it.note) updateItem(it.id, 'note', v, it.note); }} />
                          </td>
                          <td>
                            <input className="fd-input" defaultValue={it.waiting_on ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== it.waiting_on) updateItem(it.id, 'waiting_on', v, it.waiting_on); }} />
                          </td>
                          <td>
                            <input type="date" className="fd-input" defaultValue={it.waiting_since ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== it.waiting_since) updateItem(it.id, 'waiting_since', v, it.waiting_since); }} />
                          </td>
                          <td>
                            <input type="date" className="fd-input" defaultValue={it.due_on ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== it.due_on) updateItem(it.id, 'due_on', v, it.due_on); }} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={it.needs_confirm}
                              onChange={e => updateItem(it.id, 'needs_confirm', e.target.checked, it.needs_confirm)}
                            />
                          </td>
                          <td>
                            {saveS === 'saved' && <span className="fd-saved">{t('adminPanel.founderDashboard.saved')}</span>}
                            {saveS === 'failed' && <span className="fd-failed">{t('adminPanel.founderDashboard.saveFailed')}</span>}
                            <button className="fd-del-btn" onClick={() => deleteItem(it.id)}>×</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderInvestors() {
    const counts: Record<string, number> = {};
    for (const r of investors) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const contacted = investors.filter(r => r.status !== 'queued' && r.status !== 'dropped').length;
    const replies = investors.filter(r => ['replied', 'meeting', 'term', 'declined'].includes(r.status)).length;

    const filtered = invFilter === 'all' ? investors : investors.filter(r => r.status === invFilter);

    // Chart data
    const byDate: Record<string, number> = {};
    for (const r of investors) {
      if (r.status === 'queued') continue;
      if (!r.contacted_on) continue;
      byDate[r.contacted_on] = (byDate[r.contacted_on] ?? 0) + 1;
    }
    const outreachData = Object.keys(byDate).sort().map(d => ({ date: fmtDate(d), count: byDate[d] }));
    const statusData = INV_STATUS_ORDER.map(s => ({ name: invStatusLabel(s), value: counts[s] ?? 0 })).filter(d => d.value > 0);

    return (
      <div>
        {/* Stats */}
        <div className="fd-grid fd-g4 fd-section" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {[
            { v: investors.length, l: 'Tracked' },
            { v: contacted, l: t('adminPanel.founderDashboard.investorsContacted') },
            { v: replies, l: t('adminPanel.founderDashboard.investorReplies') },
            { v: contacted ? Math.round(100 * replies / contacted) + '%' : '0%', l: 'Reply rate' },
          ].map((k, i) => (
            <div key={i} className="fd-kpi">
              <div className="v" style={{ fontSize: 22 }}>{k.v}</div>
              <div className="l">{k.l}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="fd-grid fd-g2 fd-section">
          <div className="fd-card">
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>{t('adminPanel.founderDashboard.outreachChartTitle')}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={outreachData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE2" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1B2B4B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="fd-card">
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>{t('adminPanel.founderDashboard.statusChartTitle')}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                  {statusData.map((entry, i) => {
                    const key = INV_STATUS_ORDER.find(s => invStatusLabel(s) === entry.name) ?? 'sent';
                    return <Cell key={i} fill={PIE_COLORS[key as InvStatus] ?? '#8A93A3'} />;
                  })}
                </Pie>
                <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filters + table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="fd-filters" style={{ marginBottom: 0 }}>
            <button className={`fd-filter-btn ${invFilter === 'all' ? 'active' : ''}`} onClick={() => setInvFilter('all')}>
              All {investors.length}
            </button>
            {INV_STATUS_ORDER.map(s => (
              <button key={s} className={`fd-filter-btn ${invFilter === s ? 'active' : ''}`} onClick={() => setInvFilter(s)}>
                {invStatusLabel(s)} {counts[s] ?? 0}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fd-add-btn" onClick={addInvestor}>{t('adminPanel.founderDashboard.addInvestor')}</button>
            <button className="fd-ghost-btn" onClick={() => {
              const rows: string[][] = [['Entity', 'Contacted', 'What Sent', 'Route', 'Answer', 'Status']];
              for (const r of investors) rows.push([r.entity, r.contacted_on ?? '', r.what_sent ?? '', r.route ?? '', r.answer ?? '', r.status]);
              downloadCsv('investor_pipeline.csv', rows);
            }}>{t('adminPanel.founderDashboard.exportCsv')}</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="fd-table">
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>{t('adminPanel.founderDashboard.colEntity')}</th>
                <th style={{ minWidth: 110 }}>{t('adminPanel.founderDashboard.colContacted')}</th>
                <th style={{ minWidth: 200 }}>{t('adminPanel.founderDashboard.colWhatSent')}</th>
                <th style={{ minWidth: 160 }}>{t('adminPanel.founderDashboard.colRoute')}</th>
                <th style={{ minWidth: 180 }}>{t('adminPanel.founderDashboard.colAnswer')}</th>
                <th>{t('adminPanel.founderDashboard.colStatus')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const saveS = invSaveState[r.id];
                return (
                  <tr key={r.id}>
                    <td><input className="fd-input" defaultValue={r.entity} onBlur={e => { const v = e.target.value; if (v !== r.entity) updateInvestor(r.id, 'entity', v, r.entity); }} /></td>
                    <td><input type="date" className="fd-input" defaultValue={r.contacted_on ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== r.contacted_on) updateInvestor(r.id, 'contacted_on', v, r.contacted_on); }} /></td>
                    <td><input className="fd-input" defaultValue={r.what_sent ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== r.what_sent) updateInvestor(r.id, 'what_sent', v, r.what_sent); }} /></td>
                    <td><input className="fd-input" defaultValue={r.route ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== r.route) updateInvestor(r.id, 'route', v, r.route); }} /></td>
                    <td><input className="fd-input" defaultValue={r.answer ?? ''} onBlur={e => { const v = e.target.value || null; if (v !== r.answer) updateInvestor(r.id, 'answer', v, r.answer); }} /></td>
                    <td>
                      <select
                        className="fd-select"
                        value={r.status}
                        onChange={e => updateInvestor(r.id, 'status', e.target.value, r.status)}
                      >
                        {INV_STATUS_ORDER.map(s => <option key={s} value={s}>{invStatusLabel(s)}</option>)}
                      </select>
                    </td>
                    <td>
                      {saveS === 'saved' && <span className="fd-saved">{t('adminPanel.founderDashboard.saved')}</span>}
                      {saveS === 'failed' && <span className="fd-failed">{t('adminPanel.founderDashboard.saveFailed')}</span>}
                      <button className="fd-del-btn" onClick={() => deleteInvestor(r.id, r.entity)}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderLiveCounts() {
    if (!liveCounts) return null;
    const { orgsTotal, orgsLast30, dealsTotal, dealsLast30, scoresTotal, costTotal, costAvg, tokensTotal, subsByStatus, subsByPlan, retentionLog, dealsPerWeek } = liveCounts;

    return (
      <div>
        {/* Orgs + Deals */}
        <div className="fd-grid fd-g4 fd-section">
          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.organizations')}</h3>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.totalCount')}</span><b>{orgsTotal}</b></div>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.last30Days')}</span><b>{orgsLast30}</b></div>
          </div>
          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.deals')}</h3>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.totalCount')}</span><b>{dealsTotal}</b></div>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.last30Days')}</span><b>{dealsLast30}</b></div>
          </div>
          <div className="fd-card" style={{ gridColumn: 'span 2' }}>
            <h3>{t('adminPanel.founderDashboard.creditScoresSection')}</h3>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.totalScored')}</span><b>{scoresTotal}</b></div>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.totalCostCad')}</span><b>${costTotal.toFixed(2)}</b></div>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.avgCostPerDeal')}</span><b>${costAvg.toFixed(2)}</b></div>
            <div className="fd-fact"><span>{t('adminPanel.founderDashboard.totalTokens')}</span><b>{tokensTotal.toLocaleString()}</b></div>
          </div>
        </div>

        {/* Subscriptions */}
        <div className="fd-grid fd-g2 fd-section">
          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.subscriptionsSection')} — {t('adminPanel.founderDashboard.byStatus')}</h3>
            {Object.entries(subsByStatus).length === 0 && <p className="fd-muted fd-small">None</p>}
            {Object.entries(subsByStatus).map(([k, v]) => (
              <div key={k} className="fd-fact"><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
          <div className="fd-card">
            <h3>{t('adminPanel.founderDashboard.subscriptionsSection')} — {t('adminPanel.founderDashboard.byPlan')}</h3>
            {Object.entries(subsByPlan).length === 0 && <p className="fd-muted fd-small">None</p>}
            {Object.entries(subsByPlan).map(([k, v]) => (
              <div key={k} className="fd-fact"><span>{k}</span><b>{v}</b></div>
            ))}
          </div>
        </div>

        {/* Deals per week chart */}
        <div className="fd-card fd-section">
          <h3>{t('adminPanel.founderDashboard.dealsPerWeekChart')}</h3>
          {dealsPerWeek.length === 0
            ? <p className="fd-muted fd-small">No data yet.</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dealsPerWeek} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEAE2" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1B2B4B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Retention log */}
        <div className="fd-card fd-section">
          <h3>{t('adminPanel.founderDashboard.retentionLogSection')}</h3>
          {retentionLog.length === 0
            ? <p className="fd-muted fd-small">No retention log entries.</p>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table className="fd-table">
                  <thead>
                    <tr>
                      <th>{t('adminPanel.founderDashboard.colOrgName')}</th>
                      <th>{t('adminPanel.founderDashboard.colWarn30')}</th>
                      <th>{t('adminPanel.founderDashboard.colWarn14')}</th>
                      <th>{t('adminPanel.founderDashboard.colDeletedAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retentionLog.map((row, i) => (
                      <tr key={i}>
                        <td>{row.org_name ?? '—'}</td>
                        <td>{fmtDate(row.warning_30d_sent_at)}</td>
                        <td>{fmtDate(row.warning_14d_sent_at)}</td>
                        <td>{fmtDate(row.deleted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>
    );
  }

  function renderTimeline() {
    return (
      <div className="fd-card fd-section">
        <h2>{t('adminPanel.founderDashboard.timelineTitle')}</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, marginBottom: 20 }}>{t('adminPanel.founderDashboard.timelineSubtitle')}</p>
        <div className="tl-wrap">
          {TIMELINE.map((ev, i) => (
            <div key={i} className={`tl-ev ${ev.future ? 'future' : ''} ${ev.pivot ? 'pivot' : ''}`}>
              <div className="tl-date">{ev.d}</div>
              <div className="tl-title">{ev.t}</div>
              <div className="tl-body">{ev.b}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderCalendar() {
    const dueDates = new Set(items.filter(it => it.due_on).map(it => it.due_on as string));
    const [y, m] = CAL_MONTHS[calMonth];
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthLabel = new Date(y, m, 1).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' });

    const days: React.ReactNode[] = [];
    const weekdays = lang === 'fr' ? ['D', 'L', 'M', 'M', 'J', 'V', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    for (const wd of weekdays) days.push(<div key={'h-' + wd} className="cal-hdr">{wd}</div>);
    for (let i = 0; i < firstDay; i++) days.push(<div key={'p-' + i} className="cal-cell pad" />);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = iso === todayStr;
      const hasDue = dueDates.has(iso);
      const dueItems = items.filter(it => it.due_on === iso);
      days.push(
        <div key={d} className={`cal-cell ${isToday ? 'today' : ''}`}>
          {d}
          {dueItems.map((it, idx) => (
            <span key={idx} className="cal-event" title={it.name}>{it.name.slice(0, 20)}</span>
          ))}
          {isToday && !hasDue && <span className="cal-event">{t('adminPanel.founderDashboard.today')}</span>}
        </div>
      );
    }

    return (
      <div className="fd-card fd-section">
        <h2>{t('adminPanel.founderDashboard.calendarTitle')}</h2>
        <div className="cal-months">
          {CAL_MONTHS.map(([cy, cm], i) => {
            const label = new Date(cy, cm, 1).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' });
            return (
              <button key={i} className={`cal-month-btn ${calMonth === i ? 'active' : ''}`} onClick={() => setCalMonth(i)}>
                {label}
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 12 }}>{monthLabel}</p>
        <div className="cal-grid">{days}</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS = [
    { label: t('adminPanel.founderDashboard.tabOverview'),    render: renderOverview },
    { label: t('adminPanel.founderDashboard.tabItems'),       render: renderItems },
    { label: t('adminPanel.founderDashboard.tabInvestors'),   render: renderInvestors },
    { label: t('adminPanel.founderDashboard.tabLiveCounts'),  render: renderLiveCounts },
    { label: t('adminPanel.founderDashboard.tabTimeline'),    render: renderTimeline },
    { label: t('adminPanel.founderDashboard.tabCalendar'),    render: renderCalendar },
  ];

  return (
    <div className="fd-wrap">
      <style>{CSS}</style>
      <div className="fd-topbar">
        <div className="fd-topbar-left">
          <button className="fd-back" onClick={() => setLocation('/admin')}>
            {t('adminPanel.founderDashboard.backToAdmin')}
          </button>
          <span className="fd-topbar-title">🚀 Founder Dashboard</span>
        </div>
        <LanguageToggle />
      </div>

      <div className="fd-main">
        <div className="fd-tabs">
          {TABS.map((tab, i) => (
            <button key={i} className={`fd-tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <div className="fd-loading">{t('adminPanel.founderDashboard.loading')}</div>}
        {loadError && <div className="fd-error">{loadError}</div>}
        {!loading && !loadError && TABS[activeTab]?.render()}
      </div>
    </div>
  );
}
