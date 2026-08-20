// Credit memo export — PDF (pdfmake 0.3) and Word (docx 9)
// Fraunces Bold is fetched from @fontsource at PDF-generation time and embedded.

import frauncesWoffUrl from '@fontsource/fraunces/files/fraunces-latin-700-normal.woff?url';
import { translateBandUnits } from './bandUnits';
import { tRiskLabel } from './riskLabel';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoMetric {
  metric_name: string;
  metric_name_fr?: string | null;
  tier: string;
  value: number | null;
  grade: string;
  status: string;
  counted: boolean;
  strong_band: string | null;
  adequate_band: string | null;
  weak_band: string | null;
  compute_detail?: string | null;
  grade_reason?: string | null;
}

export interface MemoQuestion {
  id?: string;
  question_text: string;
  question_text_fr?: string | null;
  answer?: string | null;
  status?: string;
  priority?: string;
  source?: string;
  related_metric?: string | null;
  answer_assessment?: string | null;
}

export interface MemoData {
  lang?: string;
  deal: {
    title?: string | null;
    industry?: string | null;
    city?: string | null;
    province?: string | null;
    amount_requested?: number | null;
    term_months?: number | null;
    interest_rate?: number | null;
    executive_summary?: string | null;
    executive_summary_fr?: string | null;
    years_in_business?: number | null;
    use_of_funds?: string | null;
    existing_debt?: number | null;
    ebitda?: number | null;
    revolver_limit?: number | null;
    revolver_drawn?: number | null;
    enterprise_value?: number | null;
  };
  score?: {
    overall_score?: number | null;
    risk_label?: string | null;
    summary?: string | null;
    summary_fr?: string | null;
    strengths?: string[] | null;
    strengths_fr?: string[] | null;
    risks?: string[] | null;
    risks_fr?: string[] | null;
    coverage_pct?: number | null;
    critical_floor_applied?: boolean | null;
    capped_reason?: string | null;
    score_source?: string | null;
  } | null;
  metrics: MemoMetric[];
  confirmedCash?: number | null;
  suEntries?: Array<{ side: string; label: string; amount: number; sort_order?: number }> | null;
  capItems?: Array<{ category: string; label: string; amount: number; rate?: number | null; notes?: string | null }> | null;
  collateral?: Array<{ asset_type: string; description?: string | null; market_value: number; advance_rate: number; lending_value: number }> | null;
  benchmarks?: {
    base?: { sector: any; segment: any } | null;
    stress?: { sector: any; segment: any } | null;
    totalN?: number;
    noMapping?: boolean;
    csbfp?: { defaultRate: number; lossRate: number; totalLoans: number; totalLoanValue: number; totalClaimValue: number; reliable: boolean } | null;
  } | null;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const NAVY   = '#1B2B4B';
const GOLD   = '#C49A45';
const STRONG = '#1B5E20';
const AMBER  = '#E65100';
const RED    = '#B71C1C';
const MUTED  = '#888888';

// Mirror of scorer.ts DEFAULT_CONFIG — update both files together if these change
const GRADE_PTS: Record<string, number> = { Strong: 100, Adequate: 60, Weak: 20 };
const TIER_W:    Record<string, number>  = { Critical: 3.0, Important: 2.0, Supplementary: 1.0, Optional: 0.5 };
const TIER_ORDER = ['Critical', 'Important', 'Supplementary', 'Optional'];

const DEBT_CATS = ['Senior Debt', 'Subordinated Debt', 'Shareholder Loans'];
const CAT_ORDER: Record<string, number> = {
  'Senior Debt': 0, 'Subordinated Debt': 1, 'Shareholder Loans': 2,
  'Preferred Equity': 3, 'Common Equity': 4, 'Other': 5,
};

function fmtMoney(n: number | null | undefined, lang = 'en'): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.round(Math.abs(n));
  let s: string;
  if (lang === 'fr') {
    s = abs.toLocaleString('fr-CA') + ' $';
  } else {
    s = '$' + abs.toLocaleString('en-US');
  }
  return n < 0 ? `(${s})` : s;
}

function fmtVal(v: number | null | undefined, name: string): string {
  if (v == null) return '—';
  if (/dscr|ratio|coverage|multiple|leverage|ltv|ltr/i.test(name)) return `${v.toFixed(2)}x`;
  if (/margin|return|growth|yield/i.test(name)) return `${(v * 100).toFixed(1)}%`;
  return v.toFixed(2);
}

function gradeColor(g: string): string {
  const lo = g?.toLowerCase() ?? '';
  if (lo === 'strong')   return STRONG;
  if (lo === 'adequate') return AMBER;
  if (lo === 'weak')     return RED;
  return '#555';
}

function tGrade(g: string, t: (k: string) => string): string {
  const map: Record<string, string> = { Strong: 'memo.gradeStrong', Adequate: 'memo.gradeAdequate', Weak: 'memo.gradeWeak' };
  return map[g] ? t(map[g]) : g;
}

function tTier(tier: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    Critical: 'memo.tierCritical', Important: 'memo.tierImportant',
    Supplementary: 'memo.tierSupplementary', Optional: 'memo.tierOptional',
  };
  return map[tier] ? t(map[tier]) : tier;
}

function statusLabelT(s: string, t: (k: string) => string): string {
  const m: Record<string, string> = {
    needs_input:             'memo.statusNeedsInput',
    needs_review:            'memo.statusNeedsReview',
    qualitative:             'memo.statusQualitative',
    needs_document_or_input: 'memo.statusNeedsDoc',
    excluded:                'memo.statusExcluded',
  };
  const key = m[s?.toLowerCase() ?? ''];
  return key ? t(key) : (s ?? '—');
}

function pct(r: number | null | undefined): string {
  if (r == null) return '—';
  return `${(r * 100).toFixed(1)}%`;
}

function isoDate(): string { return new Date().toLocaleDateString('en-CA'); }

function displayDate(lang: string): string {
  if (lang === 'fr') {
    return new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  return new Date().toLocaleDateString('en-CA');
}

function memoFilename(title: string | null | undefined, ext: string, lang: string, t: (k: string) => string): string {
  const base = (title ?? '').replace(/[^a-zA-Z0-9 _\-éèêëàâùûüôîïç]/g, '').trim().replace(/\s+/g, '_') || 'Note';
  const docName = t('memo.filenameDoc');
  return `${base}_${docName}_${isoDate()}.${ext}`;
}

function sbaBand(n: number): string {
  if (n <   100_000) return '<100K';
  if (n <   250_000) return '100K–250K';
  if (n <   500_000) return '250K–500K';
  if (n < 1_000_000) return '500K–1M';
  if (n < 2_000_000) return '1M–2M';
  if (n < 5_000_000) return '2M–5M';
  return '5M+';
}

function sbaTermBand(months: number): string {
  if (months <=  60) return '≤60 mo.';
  if (months <= 120) return '61–120 mo.';
  if (months <= 240) return '121–240 mo.';
  return '>240 mo.';
}

function splitIntoParagraphs(text: string, target = 3): string[] {
  if (text.includes('\n\n')) return text.split('\n\n').map(p => p.trim()).filter(Boolean);
  if (text.includes('\n'))   return text.split('\n').map(p => p.trim()).filter(Boolean);
  const sentences: string[] = [];
  const re = /[^.!?]+[.!?]+["']?\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) sentences.push(m[0].trim());
  if (!sentences.length) return [text];
  if (sentences.length <= target) return sentences;
  const sz = Math.ceil(sentences.length / target);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += sz) out.push(sentences.slice(i, i + sz).join(' '));
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const CHUNK = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as unknown as number[])));
  }
  return btoa(parts.join(''));
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF export (pdfmake 0.3)
// ══════════════════════════════════════════════════════════════════════════════

function cell(text: string | null | undefined, opts: Record<string, any> = {}, fill?: string): any {
  return { text: text ?? '—', fontSize: 8.5, margin: [4, 3, 4, 3], fillColor: fill ?? null, ...opts };
}

function hdrCell(text: string, color = '#ffffff', fill = NAVY): any {
  return { text, bold: true, fontSize: 8.5, color, fillColor: fill, margin: [4, 5, 4, 5] };
}

const thinLayout = {
  hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0.3,
  vLineWidth: () => 0,
  hLineColor: () => '#D8D2C8',
  paddingLeft:   () => 0, paddingRight:  () => 0,
  paddingTop:    () => 0, paddingBottom: () => 0,
};

// Section heading — breakBefore forces a page break (used for Annex A only)
function pdfSection(text: string, breakBefore = false): any {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, bold: true, fontSize: 10.5, color: '#fff', fillColor: NAVY, margin: [10, 6, 10, 6] }]],
    },
    layout: 'noBorders',
    margin: [0, 16, 0, 10],
    ...(breakBefore ? { pageBreak: 'before' } : {}),
  };
}

function pdfSubHead(text: string): any {
  return { text, bold: true, fontSize: 9.5, color: NAVY, margin: [0, 8, 0, 4] };
}

function pdfHR(): any {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 0.4, lineColor: '#D8D2C8' }], margin: [0, 5, 0, 5] };
}

function pdfBullets(items: string[], color = '#222'): any[] {
  return items.map(item => ({
    columns: [
      { text: '•', width: 14, fontSize: 9, color: GOLD, margin: [8, 1, 0, 0] },
      { text: item, fontSize: 9, color, lineHeight: 1.4, margin: [0, 0, 0, 2] },
    ],
    margin: [0, 0, 0, 2],
  }));
}

// Scored metrics table: breakable (may span multiple pages), headerRows repeats header
function pdfScoredMetricsTable(rows: MemoMetric[], t: (k: string) => string, lang: string): any {
  const hdr = [
    t('memo.colMetric'), t('memo.colTier'), t('memo.colValue'),
    t('memo.colGrade'), t('memo.colStrong'), t('memo.colAdequate'), t('memo.colWeak'),
  ].map(h => hdrCell(h));
  const body = rows.map((r, i) => {
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    const displayName = (lang === 'fr' && r.metric_name_fr) ? r.metric_name_fr : r.metric_name;
    return [
      cell(displayName, {}, bg),
      cell(tTier(r.tier, t), { fontSize: 7.5, color: MUTED }, bg),
      cell(fmtVal(r.value, r.metric_name), {}, bg),
      cell(tGrade(r.grade, t), { bold: true, color: gradeColor(r.grade) }, bg),
      cell(translateBandUnits(r.strong_band, lang),   { fontSize: 7.5, color: STRONG }, bg),
      cell(translateBandUnits(r.adequate_band, lang), { fontSize: 7.5, color: AMBER  }, bg),
      cell(translateBandUnits(r.weak_band, lang),     { fontSize: 7.5, color: RED    }, bg),
    ];
  });
  return {
    // headerRows: 1 repeats the header on each continuation page.
    // keepWithHeaderRows: 1 keeps at least one data row with the header if it moves pages.
    table: { widths: ['*', 55, 52, 50, 68, 68, 68], headerRows: 1, keepWithHeaderRows: 1, body: [hdr, ...body] },
    layout: thinLayout,
    margin: [0, 0, 0, 6],
  };
}

// ── PDF section builders ──────────────────────────────────────────────────────

function pdfCover(data: MemoData, t: (k: string) => string, lang: string, fmt: (n: number | null | undefined) => string): any[] {
  const loc = [data.deal.city, data.deal.province].filter(Boolean).join(', ');
  const loanParts = [
    data.deal.amount_requested ? fmt(data.deal.amount_requested) + ' ' + t('memo.requested') : null,
    data.deal.term_months      ? t('memo.monthTerm').replace('{n}', String(data.deal.term_months)) : null,
    data.deal.interest_rate    ? t('memo.paRate').replace('{rate}', String(data.deal.interest_rate)) : null,
  ].filter(Boolean);

  const riskDisplay = data.score?.risk_label ? tRiskLabel(data.score.risk_label, t) : null;
  const scoreBlock = data.score?.overall_score != null ? [
    { text: ' ', margin: [0, 24, 0, 0] },
    { text: t('memo.creditScore'), fontSize: 10, color: MUTED, margin: [0, 0, 0, 4] },
    {
      text: `${data.score.overall_score}${riskDisplay ? '  —  ' + riskDisplay : ''}`,
      font: 'Fraunces', bold: true, fontSize: 30, color: NAVY, margin: [0, 0, 0, 0],
    },
  ] : [];

  return [
    { text: ' ', fontSize: 44, margin: [0, 36, 0, 0] },
    { text: data.deal.title ?? 'Credit Memorandum', font: 'Fraunces', bold: true, fontSize: 28, color: NAVY, margin: [0, 0, 0, 8] },
    ...(data.deal.industry ? [{ text: t('memo.industry').replace('{name}', data.deal.industry), fontSize: 12, color: MUTED, margin: [0, 0, 0, 4] }] : []),
    ...(loc ? [{ text: loc, fontSize: 11, color: MUTED, margin: [0, 0, 0, 0] }] : []),
    ...(data.deal.years_in_business != null ? [{ text: t('memo.yearsInOp').replace('{n}', String(data.deal.years_in_business)), fontSize: 10, color: MUTED, margin: [0, 2, 0, 0] }] : []),
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1.5, lineColor: GOLD }], margin: [0, 18, 0, 18] },
    ...(loanParts.length ? [{ text: loanParts.join('  ·  '), fontSize: 12, color: NAVY, margin: [0, 0, 0, 0] }] : []),
    ...scoreBlock,
    { text: displayDate(lang), fontSize: 18, color: MUTED, margin: [0, 32, 0, 0] },
    { text: '', pageBreak: 'after', margin: [0, 0, 0, 0] },
  ];
}

function pdfExecSummary(data: MemoData, t: (k: string) => string, lang: string): any[] {
  const raw = lang === 'fr' ? (data.deal.executive_summary_fr ?? data.deal.executive_summary) : data.deal.executive_summary;
  const text = raw?.trim();
  if (!text) return [];
  const paras = splitIntoParagraphs(text);
  return [
    pdfSection(t('memo.secExecSummary')),
    ...paras.map((p, i) => ({
      text: p, fontSize: 9, lineHeight: 1.55,
      margin: [0, 0, 0, i < paras.length - 1 ? 8 : 0],
      ...(i === paras.length - 1 ? { pageBreak: 'after' } : {}),
    })),
  ];
}

function pdfMetrics(data: MemoData, t: (k: string) => string, lang: string): any[] {
  const scored    = data.metrics.filter(m => m.counted);
  const notScored = data.metrics.filter(m => !m.counted);

  const out: any[] = [];

  // Section heading + notes in an unbreakable block — prevents the heading from
  // sitting alone at the bottom of a page without any content beneath it.
  const headGroup: any[] = [pdfSection(t('memo.secFinancialMetrics'))];
  if (data.score?.coverage_pct != null) {
    headGroup.push({ text: t('memo.metricCoverageNote').replace('{pct}', String(data.score.coverage_pct)), fontSize: 8.5, color: MUTED, italics: true, margin: [0, 0, 0, 10] });
  }
  if (data.score?.critical_floor_applied) {
    headGroup.push({ text: t('memo.criticalFloorNote').replace('{reason}', data.score.capped_reason ?? '').trim(), fontSize: 8.5, color: RED, italics: true, margin: [0, 0, 0, 10] });
  }
  if (scored.length > 0) headGroup.push(pdfSubHead(t('memo.scoredMetrics')));
  out.push({ stack: headGroup, unbreakable: true });

  // Scored table is intentionally breakable (can exceed one page with 17+ rows).
  // headerRows: 1 repeats the column header on each continuation page.
  if (scored.length > 0) out.push(pdfScoredMetricsTable(scored, t, lang));

  // Not-scored table: small, keep heading + table together.
  if (notScored.length > 0) {
    const nsHdr  = [t('memo.colMetric'), t('memo.colTier'), t('memo.colReason')].map(h => hdrCell(h));
    const nsRows = notScored.map((r, i) => {
      const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
      const displayName = (lang === 'fr' && r.metric_name_fr) ? r.metric_name_fr : r.metric_name;
      return [cell(displayName, {}, bg), cell(tTier(r.tier, t), { fontSize: 7.5, color: MUTED }, bg), cell(statusLabelT(r.status, t), { fontSize: 8, color: MUTED }, bg)];
    });
    const nsTable = { table: { widths: ['*', 70, '*'], headerRows: 1, body: [nsHdr, ...nsRows] }, layout: thinLayout, margin: [0, 0, 0, 6] };
    out.push({ stack: [pdfSubHead(t('memo.notScored')), nsTable], unbreakable: true });
  }

  return out;
}

function pdfAnalystCommentary(data: MemoData, t: (k: string) => string, lang: string): any[] {
  const raw = lang === 'fr' ? (data.score?.summary_fr ?? data.score?.summary) : data.score?.summary;
  const text = raw?.trim();
  if (!text) return [];
  const paras = splitIntoParagraphs(text);
  return [
    pdfSection(t('memo.secAnalystCommentary')),
    ...paras.map((p, i) => ({ text: p, fontSize: 9, lineHeight: 1.55, margin: [0, 0, 0, i < paras.length - 1 ? 10 : 0] })),
  ];
}

function pdfStrengthsRisks(data: MemoData, t: (k: string) => string, lang: string): any[] {
  const s = (lang === 'fr' ? (data.score?.strengths_fr ?? data.score?.strengths) : data.score?.strengths) ?? [];
  const r = (lang === 'fr' ? (data.score?.risks_fr     ?? data.score?.risks)     : data.score?.risks)     ?? [];
  if (!s.length && !r.length) return [];

  const sectionHead = pdfSection(t('memo.secStrengthsRisks'));
  const out: any[] = [];

  // Each list is a separate unbreakable block so Risks can move pages independently.
  // The section heading attaches to whichever list comes first.
  if (s.length) {
    out.push({ stack: [sectionHead, pdfSubHead(t('memo.keyStrengths')), ...pdfBullets(s, STRONG)], unbreakable: true });
  }
  if (r.length) {
    // If there were no strengths, the section heading needs to travel with risks.
    const risksStack = s.length
      ? [pdfSubHead(t('memo.keyRisks')), ...pdfBullets(r, RED)]
      : [sectionHead, pdfSubHead(t('memo.keyRisks')), ...pdfBullets(r, RED)];
    out.push({ stack: risksStack, unbreakable: true });
  }

  return out;
}

function pdfBenchmark(data: MemoData, t: (k: string) => string, lang: string, fmt: (n: number | null | undefined) => string): any[] {
  const bm = data.benchmarks;
  const csbfp    = bm?.csbfp;
  const hasCsbfp = !!csbfp;
  const hasSba   = !bm?.noMapping && !!(bm?.base?.sector && bm?.stress?.sector);
  if (!hasCsbfp && !hasSba) return [];

  const blocks: any[] = [pdfSection(t('memo.secHistoricalBenchmark'))];

  const fmtDollarsK = (v: number) => {
    const d = v * 1000;
    if (lang === 'fr') {
      if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G$`;
      if (d >= 1e6) return `${(d / 1e6).toFixed(1)} M$`;
      return `${Math.round(d).toLocaleString('fr-CA')} $`;
    }
    if (d >= 1e9) return `$${(d / 1e9).toFixed(2)}B`;
    if (d >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
    return `$${Math.round(d).toLocaleString('en-US')}`;
  };

  const nLoans = (n: number | null | undefined) =>
    t('memo.csbfpOfLoans').replace('{n}', (n ?? 0).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'));

  // ── Canada sub-section ──────────────────────────────────────────────────
  if (hasCsbfp) {
    const industryLabel = (data.deal.industry ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Sector';
    const drPct  = (csbfp!.defaultRate * 100).toFixed(1) + '%';
    const lrPct  = (csbfp!.lossRate   * 100).toFixed(1) + '%';
    const drDenom = nLoans(csbfp!.totalLoans);
    const lrDenom = t('memo.csbfpOfLent').replace('{amount}', fmtDollarsK(csbfp!.totalLoanValue));

    blocks.push(pdfSubHead(t('memo.canadaCSBFP')));
    // Industry label above table
    blocks.push({ text: t('memo.csbfpSectorLabel').replace('{name}', industryLabel), bold: true, fontSize: 9, color: NAVY, margin: [0, 0, 0, 6] });

    function csbfpDataCell(rate: string, denom: string, bg?: string): any {
      return {
        stack: [
          { text: rate, bold: true, fontSize: 14, color: NAVY },
          { text: denom, fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] },
        ],
        alignment: 'center', fillColor: bg ?? null, margin: [4, 6, 4, 6],
      };
    }

    const csbfpHdr = [
      { text: t('memo.colMetric'), bold: true, fontSize: 8.5, color: NAVY, fillColor: '#F0EDE8', margin: [4, 5, 4, 5] },
      {
        stack: [{ text: t('memo.csbfpCumulative'), bold: true, fontSize: 8.5, color: NAVY }],
        fillColor: '#F0EDE8', margin: [4, 5, 4, 5], alignment: 'center',
      },
    ];
    const csbfpRows = [
      csbfpHdr,
      [cell(t('memo.csbfpLoansDefaulted'), { bold: true }),  csbfpDataCell(drPct, drDenom)],
      [cell(t('memo.csbfpLoanedValueLost'), {}),             csbfpDataCell(lrPct, lrDenom, '#F8F6F3')],
    ];
    blocks.push({
      table: { widths: ['*', 150], headerRows: 1, body: csbfpRows },
      layout: { ...thinLayout, hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0.5 },
      margin: [0, 0, 0, 6],
    });
    if (!csbfp!.reliable) {
      blocks.push({ text: t('memo.csbfpSmallSample'), fontSize: 8, color: MUTED, italics: true, margin: [0, 0, 0, 4] });
    }
    blocks.push({ text: t('memo.csbfpHistory'), fontSize: 8, color: MUTED, margin: [0, 0, 0, 10] });
  }

  // ── Separator note ──────────────────────────────────────────────────────
  if (hasCsbfp && hasSba) {
    blocks.push({
      table: {
        widths: ['*'],
        body: [[{
          text: t('memo.benchmarkComparability'),
          fontSize: 7.5, color: MUTED, lineHeight: 1.5,
          border: [false, true, false, true],
          margin: [0, 6, 0, 6],
        }]],
      },
      layout: { hLineColor: () => '#E8E2D9', vLineWidth: () => 0 },
      margin: [0, 4, 0, 12],
    });
  }

  // ── US sub-section ──────────────────────────────────────────────────────
  if (hasSba) {
    const { base, stress, totalN } = bm!;
    const industryLabel = (data.deal.industry ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Sector';
    const dealSB    = sbaBand(data.deal.amount_requested ?? 0);
    const dealTB    = sbaTermBand(data.deal.term_months ?? 0);
    const baseLGD   = Math.round(base!.sector!.lgd  * 100);
    const stressLGD = Math.round(stress!.sector!.lgd * 100);
    const hasSegment = !!(base?.segment && stress?.segment);

    blocks.push(pdfSubHead(t('memo.usSba')));

    function bmDataCell(dr: number | null | undefined, n: number | null | undefined, color: string, bg?: string): any {
      return {
        stack: [
          { text: pct(dr), bold: true, fontSize: 14, color },
          { text: nLoans(n), fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] },
        ],
        alignment: 'center', fillColor: bg ?? null, margin: [4, 6, 4, 6],
      };
    }

    const tableHdr = [
      { text: t('memo.colSegment'), bold: true, fontSize: 8.5, color: NAVY, fillColor: '#F0EDE8', margin: [4, 5, 4, 5] },
      {
        stack: [{ text: t('memo.csbfpLoansDefaulted'), bold: true, fontSize: 8.5, color: NAVY }, { text: t('memo.sbaNormalCycle'), fontSize: 7.5, color: MUTED }],
        fillColor: '#F0EDE8', margin: [4, 5, 4, 5], alignment: 'center',
      },
      {
        stack: [{ text: t('memo.csbfpLoansDefaulted'), bold: true, fontSize: 8.5, color: RED }, { text: t('memo.sbaDownturn'), fontSize: 7.5, color: MUTED }],
        fillColor: '#F0EDE8', margin: [4, 5, 4, 5], alignment: 'center',
      },
    ];
    const tableRows: any[][] = [tableHdr];
    tableRows.push([
      cell(t('memo.csbfpSectorLabel').replace('{name}', industryLabel), { bold: true }),
      bmDataCell(base!.sector!.default_rate, base!.sector!.n_loans, NAVY),
      bmDataCell(stress!.sector!.default_rate, stress!.sector!.n_loans, RED),
    ]);
    if (hasSegment) {
      tableRows.push([
        { stack: [{ text: `${dealSB} · ${dealTB}`, bold: true, fontSize: 8.5 }, { text: t('memo.sbaSimilarLoans'), fontSize: 7.5, color: MUTED }], fillColor: '#F8F6F3', margin: [4, 4, 4, 4] },
        bmDataCell(base!.segment!.default_rate, base!.segment!.n_loans, NAVY, '#F8F6F3'),
        bmDataCell(stress!.segment!.default_rate, stress!.segment!.n_loans, RED, '#F8F6F3'),
      ]);
    }
    blocks.push({
      table: { widths: ['*', 140, 140], headerRows: 1, body: tableRows },
      layout: { ...thinLayout, hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0.5 },
      margin: [0, 0, 0, 12],
    });

    if (hasSegment && base?.sector?.default_rate) {
      const ratio = base!.segment!.default_rate / base!.sector!.default_rate;
      if (ratio >= 1.3 || ratio <= 0.75) {
        const msg = ratio >= 1.3 ? t('memo.sbaHigherDefault') : t('memo.sbaLowerDefault');
        blocks.push({
          table: { widths: [3, '*'], body: [[{ text: '', fillColor: GOLD, border: [false, false, false, false] }, { text: msg, fontSize: 8.5, lineHeight: 1.5, margin: [8, 4, 4, 4], border: [false, false, false, false] }]] },
          layout: 'noBorders', margin: [0, 0, 0, 12],
        });
      }
    }

    const lgdText = t('memo.lgdText').replace('{base}', String(baseLGD)).replace('{stress}', String(stressLGD));
    const lgdCtx  = t('memo.lgdContext').replace('{n}', (totalN ?? 0).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'));

    blocks.push(
      { text: t('memo.lgdTitle'), bold: true, fontSize: 8, color: MUTED, margin: [0, 4, 0, 4], characterSpacing: 1 },
      { text: lgdText, fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 10] },
      { text: lgdCtx,  fontSize: 8, color: MUTED, lineHeight: 1.5 },
    );
  }

  return [{ stack: blocks, unbreakable: true }];
}

function pdfSourcesUses(data: MemoData, t: (k: string) => string, fmt: (n: number | null | undefined) => string): any[] {
  const entries = data.suEntries ?? [];
  if (!entries.length) return [];

  const uses   = entries.filter(e => e.side === 'use');
  const srcs   = entries.filter(e => e.side === 'source');
  const totalU = uses.reduce((s, e) => s + Number(e.amount), 0);
  const totalS = srcs.reduce((s, e) => s + Number(e.amount), 0);
  const maxLen = Math.max(uses.length, srcs.length);

  const subHdr = [
    { text: t('memo.suUses'),    bold: true, fontSize: 8, color: MUTED, fillColor: '#F0EDE8', margin: [4, 4, 4, 4], colSpan: 2 }, {},
    { text: t('memo.suSources'), bold: true, fontSize: 8, color: MUTED, fillColor: '#F0EDE8', margin: [4, 4, 4, 4], colSpan: 2 }, {},
  ];
  const rows = Array.from({ length: maxLen }, (_, i) => {
    const u = uses[i]; const s = srcs[i];
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(u?.label ?? '', {}, bg),
      cell(u ? fmt(Number(u.amount)) : '', { alignment: 'right' }, bg),
      cell(s?.label ?? '', {}, bg),
      cell(s ? fmt(Number(s.amount)) : '', { alignment: 'right' }, bg),
    ];
  });
  rows.push([
    cell(t('memo.totalUses'),   { bold: true, fontSize: 9 }, '#E8E2D9'),
    cell(fmt(totalU), { bold: true, alignment: 'right', fontSize: 9 }, '#E8E2D9'),
    cell(t('memo.totalSources'),{ bold: true, fontSize: 9 }, '#E8E2D9'),
    cell(fmt(totalS), { bold: true, alignment: 'right', fontSize: 9 }, '#E8E2D9'),
  ]);

  const suLayout = {
    hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : (i === 1 ? 0.5 : 0.3),
    vLineWidth: (i: number) => i === 2 ? 0.5 : 0,
    hLineColor: () => '#D8D2C8',
    vLineColor: () => '#D8D2C8',
    paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
  };

  const suTable = { table: { widths: ['*', 90, '*', 90], body: [subHdr, ...rows] }, layout: suLayout, margin: [0, 0, 0, 6] };

  // Heading + table together — neither starts on a page without the other.
  return [{ stack: [pdfSection(t('memo.secSourcesUses')), suTable], unbreakable: true }];
}

function pdfCapitalization(data: MemoData, t: (k: string) => string, fmt: (n: number | null | undefined) => string): any[] {
  const items = data.capItems ?? [];
  if (!items.length) return [];

  const ebitdaVal  = Number(data.deal?.ebitda);
  const hasEbitda  = ebitdaVal > 0;
  const cashVal    = Number(data.confirmedCash) || 0;
  const rl         = data.deal?.revolver_limit  != null ? Number(data.deal.revolver_limit)  : null;
  const rd         = data.deal?.revolver_drawn  != null ? Number(data.deal.revolver_drawn)   : null;
  const evProv     = data.deal?.enterprise_value != null ? Number(data.deal.enterprise_value) : null;

  const sorted    = [...items].sort((a, b) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99));
  const totalCap  = items.reduce((s, r) => s + Number(r.amount), 0);
  const totalDebt = items.filter(r => DEBT_CATS.includes(r.category)).reduce((s, r) => s + Number(r.amount), 0);
  const seniorDebt= items.filter(r => r.category === 'Senior Debt').reduce((s, r) => s + Number(r.amount), 0);
  const totalEquity = totalCap - totalDebt;
  const netDebt   = totalDebt - cashVal;
  const availLiq  = cashVal + (rl != null ? (rl - (rd ?? 0)) : 0);
  const evProxy   = totalCap - cashVal;

  const colW: any[] = hasEbitda ? ['*', 80, 90, 75, 75] : ['*', 80, 90, 75];
  const hdrLabels = [t('memo.colInstrument'), t('memo.colCategory'), t('memo.colAmount'), t('memo.colPctOfCap'), ...(hasEbitda ? [t('memo.colTimesEbitda')] : [])];
  const hdr = hdrLabels.map(h => hdrCell(h));

  let cumDebt = 0;
  const dataRows = sorted.map((r, i) => {
    const amt    = Number(r.amount);
    const pctCap = totalCap > 0 ? `${(amt / totalCap * 100).toFixed(1)}%` : '—';
    let xE = '—';
    if (hasEbitda && DEBT_CATS.includes(r.category)) { cumDebt += amt; xE = `${(cumDebt / ebitdaVal).toFixed(2)}x`; }
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    const row = [
      cell(r.label, { color: NAVY }, bg),
      cell(r.category, { color: MUTED }, bg),
      cell(fmt(amt), { alignment: 'right' }, bg),
      cell(pctCap, { alignment: 'right', color: MUTED }, bg),
    ];
    if (hasEbitda) row.push(cell(xE, { alignment: 'right', color: DEBT_CATS.includes(r.category) ? NAVY : MUTED }, bg));
    return row;
  });

  function summaryRow(label: string, isBold: boolean, amount: number, pctStr: string, xEStr: string): any[] {
    const bg = '#FAFAF9';
    const row = [
      cell(label, { bold: isBold, color: isBold ? NAVY : MUTED, colSpan: 2 }, bg), {},
      cell(fmt(amount), { bold: isBold, alignment: 'right', color: isBold ? NAVY : undefined }, bg),
      cell(pctStr, { alignment: 'right', color: isBold ? NAVY : MUTED }, bg),
    ];
    if (hasEbitda) row.push(cell(xEStr, { alignment: 'right', color: isBold ? NAVY : MUTED }, bg));
    return row;
  }

  const debtPct = totalCap > 0 ? `${(totalDebt  / totalCap * 100).toFixed(1)}%` : '—';
  const eqPct   = totalCap > 0 ? `${(totalEquity / totalCap * 100).toFixed(1)}%` : '—';
  const debtXE  = hasEbitda && totalDebt > 0 ? `${(totalDebt / ebitdaVal).toFixed(2)}x` : '—';

  const allRows = [
    ...dataRows,
    summaryRow(t('memo.totalDebt'),           false, totalDebt,   debtPct, debtXE),
    summaryRow(t('memo.totalEquity'),         false, totalEquity, eqPct,   '—'),
    summaryRow(t('memo.totalCapitalization'), true,  totalCap,    '100%',  debtXE),
  ];

  const capTable = { table: { widths: colW, headerRows: 1, body: [hdr, ...allRows] }, layout: thinLayout, margin: [0, 0, 0, 12] };

  const creditMetrics: Array<{ label: string; value: string }> = [
    { label: t('memo.capSeniorDebtEbitda'),  value: hasEbitda && seniorDebt > 0 ? `${(seniorDebt / ebitdaVal).toFixed(2)}x` : 'n/m' },
    { label: t('memo.capTotalDebtEbitda'),   value: hasEbitda ? `${(totalDebt / ebitdaVal).toFixed(2)}x` : 'n/m' },
    { label: t('memo.capNetDebtEbitda'),     value: hasEbitda ? `${(netDebt   / ebitdaVal).toFixed(2)}x` : 'n/m' },
    ...(rl != null ? [{ label: t('memo.capRevolverLimit'), value: fmt(rl) }] : []),
    { label: rl == null ? t('memo.capAvailLiqCashOnly') : t('memo.capAvailLiq'), value: fmt(availLiq) },
    evProv != null
      ? { label: t('memo.capEvProvided'),  value: fmt(evProv) }
      : totalEquity > 0
        ? { label: t('memo.capEvProxy'),   value: fmt(evProxy) }
        : { label: t('memo.capEvProxyNm'), value: t('memo.capNmAddEquity') },
    { label: t('memo.capDebtTotalCap'), value: totalCap > 0 ? `${(totalDebt / totalCap * 100).toFixed(1)}%` : '—' },
  ];

  const metricsBody = creditMetrics.map((m, i) => [
    cell(m.label, { color: MUTED }, i % 2 === 1 ? '#F8F6F3' : undefined),
    cell(m.value, { alignment: 'right', bold: true, color: NAVY }, i % 2 === 1 ? '#F8F6F3' : undefined),
  ]);
  const metricsTable = { table: { widths: ['*', 100], body: metricsBody }, layout: thinLayout, margin: [0, 0, 0, 6] };

  const blockItems: any[] = [
    pdfSection(t('memo.secCapitalization')),
    { text: t('memo.proFormaNote'), fontSize: 8.5, color: MUTED, italics: true, margin: [0, 0, 0, 10] },
    capTable,
    metricsTable,
  ];
  if (hasEbitda) {
    const ebitdaRef = t('memo.capEbitdaRef').replace('{amount}', fmt(ebitdaVal));
    const cashRef   = cashVal > 0 ? `  ·  ${t('memo.capCashRef').replace('{amount}', fmt(cashVal))}` : '';
    blockItems.push({ text: `${ebitdaRef}${cashRef}`, fontSize: 8, color: MUTED, italics: true, margin: [0, 4, 0, 0] });
  }

  // The whole cap section — heading, pro-forma note, cap table, credit metrics — stays together.
  return [{ stack: blockItems, unbreakable: true }];
}

function pdfCollateral(data: MemoData, t: (k: string) => string, fmt: (n: number | null | undefined) => string): any[] {
  const items = data.collateral ?? [];
  if (!items.length) return [];

  const hdr  = [t('memo.colAssetType'), t('memo.colDescription'), t('memo.colMarketValue'), t('memo.colAdvanceRate'), t('memo.colLendingValue')].map(h => hdrCell(h));
  const rows = items.map((it, i) => {
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(it.asset_type, {}, bg),
      cell(it.description, {}, bg),
      cell(fmt(Number(it.market_value)),  { alignment: 'right' }, bg),
      cell(`${Math.round((it.advance_rate ?? 0) * 100)}%`, { alignment: 'right' }, bg),
      cell(fmt(Number(it.lending_value)), { alignment: 'right' }, bg),
    ];
  });
  const totalL = items.reduce((s, it) => s + Number(it.lending_value), 0);
  rows.push([
    cell(t('memo.totalLendingValue'), { bold: true, colSpan: 4 }, '#E8E2D9'), {}, {}, {},
    cell(fmt(totalL), { bold: true, alignment: 'right' }, '#E8E2D9'),
  ]);

  const collTable = { table: { widths: [80, '*', 82, 72, 82], headerRows: 1, body: [hdr, ...rows] }, layout: thinLayout, margin: [0, 0, 0, 6] };
  return [{ stack: [pdfSection(t('memo.secCollateral')), collTable], unbreakable: true }];
}

function pdfDiligence(questions: MemoQuestion[], t: (k: string) => string, lang: string): any[] {
  if (!questions.length) return [];

  // The section heading gets its own page break; it's not wrapped in unbreakable
  // with questions because the first question may be long.
  const out: any[] = [pdfSection(t('memo.secAnnexA'), true)];

  questions.forEach((q, i) => {
    const tag = [q.priority?.toUpperCase(), q.source].filter(Boolean).join(' · ');
    const qText = (lang === 'fr' && q.question_text_fr) ? q.question_text_fr : q.question_text;

    // Each question + its answer stay together as one unbreakable block.
    const qItems: any[] = [
      {
        columns: [
          { text: `Q${i + 1}.`, bold: true, fontSize: 9, color: NAVY, width: 28, margin: [0, 1, 0, 0] },
          {
            stack: [
              { text: [{ text: qText, bold: true, fontSize: 9 }, tag ? { text: `  [${tag}]`, fontSize: 7.5, color: MUTED } : ''] },
              ...(q.related_metric ? [{ text: t('memo.related').replace('{metric}', q.related_metric), fontSize: 7.5, color: MUTED, italics: true, margin: [0, 2, 0, 0] }] : []),
              ...(q.answer?.trim() ? [
                { text: t('memo.response'), fontSize: 8, bold: true, color: NAVY, margin: [0, 5, 0, 2] },
                { text: q.answer.trim(), fontSize: 8.5, lineHeight: 1.4 },
                ...(q.answer_assessment?.trim() ? [{ text: t('memo.assessment').replace('{text}', q.answer_assessment.trim()), fontSize: 8, color: MUTED, italics: true, margin: [0, 3, 0, 0] }] : []),
              ] : [
                { text: t('memo.statusLabel').replace('{text}', q.status ?? t('memo.pending')), fontSize: 8, color: MUTED, italics: true, margin: [0, 2, 0, 0] },
              ]),
            ],
            width: '*',
          },
        ],
        margin: [0, 0, 0, 8],
      },
    ];
    out.push({ stack: qItems, unbreakable: true });

    // Divider between questions is outside the unbreakable block — it can sit anywhere.
    if (i < questions.length - 1) out.push(pdfHR());
  });

  return out;
}

interface TierBreakdown {
  tier: string; weight: number;
  strong: number; adequate: number; weak: number;
  tierTotalWeight: number; weightedPoints: number;
}

function calcScoreBreakdown(metrics: MemoMetric[]): {
  tiers: TierBreakdown[]; totalWeightedPoints: number; totalWeight: number; computedScore: number | null;
} {
  const tierMap = new Map<string, TierBreakdown>();
  for (const m of metrics.filter(m => m.counted)) {
    const pts = GRADE_PTS[m.grade];
    const w   = TIER_W[m.tier] ?? 2.0;
    if (pts == null) continue;
    if (!tierMap.has(m.tier)) tierMap.set(m.tier, { tier: m.tier, weight: w, strong: 0, adequate: 0, weak: 0, tierTotalWeight: 0, weightedPoints: 0 });
    const e = tierMap.get(m.tier)!;
    if (m.grade === 'Strong') e.strong++; else if (m.grade === 'Adequate') e.adequate++; else if (m.grade === 'Weak') e.weak++;
    e.tierTotalWeight += w;
    e.weightedPoints  += pts * w;
  }
  const tiers = [...tierMap.values()].sort((a, b) => (TIER_ORDER.indexOf(a.tier) ?? 99) - (TIER_ORDER.indexOf(b.tier) ?? 99));
  const totalWeightedPoints = tiers.reduce((s, tt) => s + tt.weightedPoints, 0);
  const totalWeight         = tiers.reduce((s, tt) => s + tt.tierTotalWeight, 0);
  const computedScore = totalWeight > 0 ? Math.round((totalWeightedPoints / totalWeight) * 10) / 10 : null;
  return { tiers, totalWeightedPoints, totalWeight, computedScore };
}

function pdfScoreCalcSection(data: MemoData, t: (k: string) => string, lang: string): any {
  const { tiers, totalWeightedPoints, totalWeight, computedScore } = calcScoreBreakdown(data.metrics);
  const storedScore = data.score?.overall_score ?? null;
  const reconciled  = computedScore != null && storedScore != null && computedScore === storedScore;

  const items: any[] = [pdfSubHead(t('memo.howScoreCalc'))];

  // Lead-in
  items.push({ text: t('memo.scoreLeadIn'), fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 10] });

  // Reference tables — grade points and tier weights side by side
  const gradeHdr  = [hdrCell(t('memo.gradePoints').split(' → ')[0]), hdrCell('Points')];
  const gradeRows = [
    [cell(t('memo.gradeStrong'),   { color: STRONG }), cell('100', { alignment: 'right' })],
    [cell(t('memo.gradeAdequate'), { color: AMBER  }), cell('60',  { alignment: 'right' })],
    [cell(t('memo.gradeWeak'),     { color: RED    }), cell('20',  { alignment: 'right' })],
  ];
  const tierHdr  = [hdrCell(t('memo.tierWeight').split(' → ')[0]), hdrCell('Weight')];
  const tierRows = [
    [cell(t('memo.tierCritical')),      cell('3.0', { alignment: 'right' })],
    [cell(t('memo.tierImportant')),     cell('2.0', { alignment: 'right' })],
    [cell(t('memo.tierSupplementary')), cell('1.0', { alignment: 'right' })],
    [cell(t('memo.tierOptional')),      cell('0.5', { alignment: 'right' })],
  ];
  items.push({
    columns: [
      { width: '*', stack: [
        { text: t('memo.gradePoints'), bold: true, fontSize: 8.5, color: NAVY, margin: [0, 0, 0, 4] },
        { table: { widths: ['*', 50], headerRows: 1, body: [gradeHdr, ...gradeRows] }, layout: thinLayout },
      ], margin: [0, 0, 10, 0] },
      { width: '*', stack: [
        { text: t('memo.tierWeight'), bold: true, fontSize: 8.5, color: NAVY, margin: [0, 0, 0, 4] },
        { table: { widths: ['*', 50], headerRows: 1, body: [tierHdr, ...tierRows] }, layout: thinLayout },
      ] },
    ],
    margin: [0, 0, 0, 12],
  });

  // Deal-specific calculation table
  if (tiers.length === 0) {
    items.push({ text: t('memo.insufficientMetrics'), fontSize: 8.5, color: MUTED, italics: true, margin: [0, 0, 0, 10] });
  } else if (!reconciled) {
    items.push({ text: t('memo.reconcileNote'), fontSize: 8.5, color: AMBER, italics: true, margin: [0, 0, 0, 10] });
  } else {
    const totalCount = tiers.reduce((s, tt) => s + tt.strong + tt.adequate + tt.weak, 0);
    items.push({ text: t('memo.scoreCalcDeal').replace('{n}', String(totalCount)), bold: true, fontSize: 8.5, color: NAVY, margin: [0, 0, 0, 6] });

    const calcHdr = [t('memo.colTier'), 'Weight', t('memo.colCount'), t('memo.gradeStrong'), t('memo.gradeAdequate'), t('memo.gradeWeak'), t('memo.colWtdPoints')].map(h => hdrCell(h));
    const calcRows = tiers.map((tt, i) => {
      const bg    = i % 2 === 1 ? '#F8F6F3' : undefined;
      const count = tt.strong + tt.adequate + tt.weak;
      return [
        cell(tTier(tt.tier, t), { bold: true, color: NAVY }, bg),
        cell(tt.weight.toFixed(1), { alignment: 'right' }, bg),
        cell(String(count),     { alignment: 'right' }, bg),
        cell(String(tt.strong),   { alignment: 'right', color: tt.strong   > 0 ? STRONG : MUTED }, bg),
        cell(String(tt.adequate), { alignment: 'right', color: tt.adequate > 0 ? AMBER  : MUTED }, bg),
        cell(String(tt.weak),     { alignment: 'right', color: tt.weak     > 0 ? RED    : MUTED }, bg),
        cell(totalWeightedPoints.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'), { alignment: 'right', bold: true }, bg),
      ];
    });
    // Totals row
    calcRows.push([
      cell(t('memo.totals'), { bold: true, color: NAVY, colSpan: 2 }, '#E8E2D9'), {},
      cell(String(totalCount), { alignment: 'right', bold: true }, '#E8E2D9'),
      { text: '', fillColor: '#E8E2D9' }, { text: '', fillColor: '#E8E2D9' }, { text: '', fillColor: '#E8E2D9' },
      cell(totalWeightedPoints.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'), { alignment: 'right', bold: true }, '#E8E2D9'),
    ]);
    items.push({ table: { widths: ['*', 42, 38, 40, 52, 32, 68], headerRows: 1, body: [calcHdr, ...calcRows] }, layout: thinLayout, margin: [0, 0, 0, 6] });

    // Formula line
    const rawExact   = totalWeightedPoints / totalWeight;
    const isExact    = Math.round(rawExact * 10) / 10 === rawExact && rawExact === Math.floor(rawExact * 10) / 10;
    const rawDisplay = isExact ? String(computedScore) : rawExact.toFixed(3) + '…';
    const twStr      = totalWeight % 1 === 0 ? totalWeight.toFixed(0) : totalWeight.toFixed(1);
    items.push({
      columns: [
        { text: t('memo.sumWeights').replace('{w}', twStr), fontSize: 8.5, color: MUTED, width: 110 },
        { text: [
          { text: `${totalWeightedPoints.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US')} ÷ ${twStr} = ${rawDisplay}` },
          { text: ` → `, color: MUTED },
          { text: String(computedScore), bold: true, fontSize: 10, color: NAVY },
        ], fontSize: 8.5 },
      ],
      margin: [0, 2, 0, 10],
    });
  }

  // Critical floor
  items.push({ text: t('memo.criticalFloorLabel'), bold: true, fontSize: 8.5, margin: [0, 0, 0, 4] });
  items.push({ text: t('memo.criticalFloorDesc'), fontSize: 8.5, lineHeight: 1.5, margin: [0, 0, 0, 4] });

  const floorApplied = data.score?.critical_floor_applied;
  const floorReason  = data.score?.capped_reason;
  if (floorApplied) {
    const why = floorReason === 'severe_critical' ? t('memo.floorAppliedSevere') : t('memo.floorAppliedWeak');
    const floorMsg = t('memo.floorAppliedDeal').replace('{why}', why);
    items.push({ text: [{ text: t('memo.forThisDeal'), bold: true }, { text: floorMsg, color: RED }], fontSize: 8.5, margin: [0, 0, 0, 10] });
  } else {
    items.push({ text: [{ text: t('memo.forThisDeal'), bold: true }, { text: t('memo.floorNotAppliedDeal'), color: STRONG }], fontSize: 8.5, margin: [0, 0, 0, 10] });
  }

  // Lender configurability note
  items.push({ text: t('memo.lenderConfig'), fontSize: 8, color: MUTED, lineHeight: 1.5, italics: true });

  return { stack: items, unbreakable: true };
}

function pdfMethodology(data: MemoData, t: (k: string) => string, lang: string): any[] {
  return [
    pdfSection(t('memo.secMethodology'), true),
    pdfScoreCalcSection(data, t, lang),
    pdfSubHead(t('memo.secScoringFramework')),
    { text: t('memo.scoringFrameworkText'), fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead(t('memo.secMetricTiers')),
    { text: t('memo.metricTiersText'), fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead(t('memo.secDataSources')),
    { text: t('memo.dataSourcesText'), fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead(t('memo.secHistBenchmarkMeth')),
    { text: t('memo.histBenchmarkText'), fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead(t('memo.secDisclaimer')),
    { text: t('memo.disclaimerText'), fontSize: 9, lineHeight: 1.5, color: MUTED, italics: true },
  ];
}

function buildPdfDef(data: MemoData, questions: MemoQuestion[], t: (k: string) => string, lang: string): any {
  const borrower = data.deal.title ?? 'Credit Memorandum';
  const fmt = (n: number | null | undefined) => fmtMoney(n, lang);
  const content: any[] = [
    ...pdfCover(data, t, lang, fmt),
    ...pdfExecSummary(data, t, lang),
    ...pdfMetrics(data, t, lang),
    ...pdfAnalystCommentary(data, t, lang),
    ...pdfStrengthsRisks(data, t, lang),
    ...pdfBenchmark(data, t, lang, fmt),
    ...pdfSourcesUses(data, t, fmt),
    ...pdfCapitalization(data, t, fmt),
    ...pdfCollateral(data, t, fmt),
    ...pdfDiligence(questions, t, lang),
    ...pdfMethodology(data, t, lang),
  ];

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 54, 40, 54],
    header: (currentPage: number) => {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: borrower, fontSize: 7.5, color: MUTED, margin: [40, 14, 0, 0] },
          { text: t('memo.confidentialHeader'), fontSize: 7, color: MUTED, alignment: 'right', margin: [0, 14, 40, 0] },
        ],
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) {
        return { text: t('memo.confidentialDraft'), fontSize: 8, bold: true, color: MUTED, alignment: 'center', margin: [40, 0, 40, 14] };
      }
      return {
        columns: [
          { text: displayDate(lang), fontSize: 7, color: MUTED, margin: [40, 0, 0, 14] },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7, color: MUTED, margin: [0, 0, 40, 14] },
        ],
      };
    },
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#222222' },
  };
}

export async function downloadPDF(data: MemoData, questions: MemoQuestion[], t: (key: string) => string): Promise<void> {
  const lang = data.lang ?? 'en';
  const [pdfMakeModule, pdfFontsModule, fontBuffer] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    fetch(frauncesWoffUrl).then(r => r.arrayBuffer()),
  ]);

  const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule;
  const vfs     = (pdfFontsModule as any).default ?? pdfFontsModule;

  pdfMake.addVirtualFileSystem(typeof vfs === 'object' && 'default' in vfs ? (vfs as any).default : vfs);
  pdfMake.addVirtualFileSystem({ 'Fraunces-Bold.woff': arrayBufferToBase64(fontBuffer) });
  // In pdfmake 0.3, fonts must be registered on the instance, not in docDefinition.
  pdfMake.addFonts({ Fraunces: { normal: 'Fraunces-Bold.woff', bold: 'Fraunces-Bold.woff' } });

  const docDef = buildPdfDef(data, questions, t, lang);
  await pdfMake.createPdf(docDef).download(memoFilename(data.deal.title, 'pdf', lang, t));
}

// ══════════════════════════════════════════════════════════════════════════════
// Word export (docx 9)
// ══════════════════════════════════════════════════════════════════════════════

export async function downloadDocx(data: MemoData, questions: MemoQuestion[], t: (key: string) => string): Promise<void> {
  const lang = data.lang ?? 'en';
  const fmt  = (n: number | null | undefined) => fmtMoney(n, lang);

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, Header, Footer, PageBreak,
    ShadingType, BorderStyle, PageNumber,
  } = await import('docx');

  const TWIP_PG = 12240;
  const MARGIN  = 1080;
  const TW_CONT = TWIP_PG - MARGIN * 2;

  const noBorder    = { style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' };
  const rowBorder   = { style: BorderStyle.SINGLE,  size: 4, color: 'D8D2C8' };
  const thickBorder = { style: BorderStyle.SINGLE,  size: 8, color: 'D8D2C8' };

  function shade(fill: string): any { return { fill: fill.replace('#', ''), type: ShadingType.CLEAR, color: fill.replace('#', '') }; }

  function wPara(text: string, opts: Record<string, any> = {}): any {
    return new Paragraph({
      children: [new TextRun({ text, size: opts.size ?? 20, bold: opts.bold, color: (opts.color ?? '222222').replace('#', ''), italics: opts.italics, font: opts.font })],
      alignment: opts.align ?? AlignmentType.LEFT,
      spacing: { after: opts.spaceAfter ?? 120, before: opts.spaceBefore ?? 0 },
      keepNext: opts.keepNext ?? false,
      keepLines: opts.keepLines ?? false,
    });
  }

  // keepNext: true ensures the heading paragraph is never the last element on a page.
  function wHead1(text: string, pb = false): any {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 26, color: 'FFFFFF', font: 'Fraunces' })],
      shading: shade(NAVY),
      spacing: { before: 200, after: 120 },
      keepNext: true,
      ...(pb ? { pageBreakBefore: true } : {}),
    });
  }

  function wHead2(text: string): any {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 22, color: NAVY.replace('#', ''), font: 'Calibri' })],
      spacing: { before: 160, after: 80 },
      keepNext: true,
    });
  }

  function wBullet(text: string, color = '222222', keepNext = false): any {
    return new Paragraph({
      children: [new TextRun({ text: `• ${text}`, size: 20, color: color.replace('#', '') })],
      spacing: { after: 60 },
      indent: { left: 360 },
      keepNext,
    });
  }

  function wPageBreak(): any { return new Paragraph({ children: [new PageBreak()] }); }
  function wSpacer(after = 120): any { return new Paragraph({ spacing: { after } }); }

  // cantSplit: true prevents a table row from being split across a page boundary.
  function wHdrRow(cells: string[], widths: number[]): any {
    return new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: cells.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: shade(NAVY),
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 18, color: 'FFFFFF', font: 'Calibri' })], spacing: { after: 0 } })],
      })),
    });
  }

  function wDataRow(cells: string[], widths: number[], shaded = false, bold = false): any {
    const fill = shaded ? 'F8F6F3' : 'FFFFFF';
    return new TableRow({
      cantSplit: true,
      children: cells.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: shade(fill),
        borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({ children: [new TextRun({ text: c, size: 18, bold, font: 'Calibri' })], spacing: { after: 0 } })],
      })),
    });
  }

  function wTotalRow(cells: string[], widths: number[], fill = 'E8E2D9'): any {
    return new TableRow({
      cantSplit: true,
      children: cells.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: shade(fill),
        borders: { top: thickBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({ children: [new TextRun({ text: c, size: 18, bold: true, font: 'Calibri' })], spacing: { after: 0 } })],
      })),
    });
  }

  const nLoans = (n: number | null | undefined) =>
    t('memo.csbfpOfLoans').replace('{n}', (n ?? 0).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'));

  const fmtDollarsKW = (v: number) => {
    const d = v * 1000;
    if (lang === 'fr') {
      if (d >= 1e9) return `${(d / 1e9).toFixed(2)} G$`;
      if (d >= 1e6) return `${(d / 1e6).toFixed(1)} M$`;
      return `${Math.round(d).toLocaleString('fr-CA')} $`;
    }
    if (d >= 1e9) return `$${(d / 1e9).toFixed(2)}B`;
    if (d >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
    return `$${Math.round(d).toLocaleString('en-US')}`;
  };

  const children: any[] = [];

  // ── Cover ──
  const riskDisplay = data.score?.risk_label ? tRiskLabel(data.score.risk_label, t) : null;
  children.push(
    new Paragraph({ children: [new TextRun({ text: data.deal.title ?? 'Credit Memorandum', bold: true, size: 52, color: NAVY.replace('#', ''), font: 'Fraunces' })], spacing: { before: 1440, after: 240 } }),
    ...(data.deal.industry ? [new Paragraph({ children: [new TextRun({ text: t('memo.industry').replace('{name}', data.deal.industry), size: 24, color: '888888', font: 'Calibri' })], spacing: { after: 120 } })] : []),
    ...([data.deal.city, data.deal.province].filter(Boolean).length > 0 ? [new Paragraph({ children: [new TextRun({ text: [data.deal.city, data.deal.province].filter(Boolean).join(', '), size: 22, color: '888888', font: 'Calibri' })], spacing: { after: 120 } })] : []),
  );
  if (data.score?.overall_score != null) {
    children.push(
      wSpacer(240),
      new Paragraph({ children: [new TextRun({ text: t('memo.creditScore'), size: 20, color: '888888', font: 'Calibri' })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: `${data.score.overall_score}${riskDisplay ? '  —  ' + riskDisplay : ''}`, bold: true, size: 56, color: NAVY.replace('#', ''), font: 'Fraunces' })], spacing: { after: 240 } }),
    );
  }
  children.push(
    new Paragraph({ children: [new TextRun({ text: displayDate(lang), size: 36, color: '888888', font: 'Calibri' })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: t('memo.confidentialDraft'), bold: true, size: 18, color: '888888', font: 'Calibri' })], spacing: { after: 0 } }),
    wPageBreak(),
  );

  // ── Executive Summary ──
  const execRaw  = lang === 'fr' ? (data.deal.executive_summary_fr ?? data.deal.executive_summary) : data.deal.executive_summary;
  const execText = execRaw?.trim();
  if (execText) {
    children.push(wHead1(t('memo.secExecSummary').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));
    splitIntoParagraphs(execText).forEach(p => children.push(wPara(p, { spaceAfter: 160 })));
    children.push(wPageBreak());
  }

  // ── Financial Metrics ──
  children.push(wHead1(t('memo.secFinancialMetrics').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));
  if (data.score?.coverage_pct != null) children.push(wPara(t('memo.metricCoverageNote').replace('{pct}', String(data.score.coverage_pct)), { italics: true, color: '888888', spaceAfter: 160 }));

  const scored    = data.metrics.filter(m => m.counted);
  const notScored = data.metrics.filter(m => !m.counted);

  if (scored.length > 0) {
    children.push(wHead2(t('memo.scoredMetrics')));
    const mCols = [2800, 620, 620, 620, 1000, 1000, 1000];
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow([t('memo.colMetric'), t('memo.colTier'), t('memo.colValue'), t('memo.colGrade'), t('memo.colStrong'), t('memo.colAdequate'), t('memo.colWeak')], mCols),
        ...scored.map((r, i) => {
          const displayName = (lang === 'fr' && r.metric_name_fr) ? r.metric_name_fr : r.metric_name;
          return wDataRow([
            displayName,
            tTier(r.tier, t),
            fmtVal(r.value, r.metric_name),
            tGrade(r.grade, t),
            translateBandUnits(r.strong_band, lang) ?? '—',
            translateBandUnits(r.adequate_band, lang) ?? '—',
            translateBandUnits(r.weak_band, lang) ?? '—',
          ], mCols, i % 2 === 1);
        }),
      ],
    }), wSpacer(200));
  }

  if (notScored.length > 0) {
    children.push(wHead2(t('memo.notScored')));
    const nsCols = [3800, 800, 3060];
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow([t('memo.colMetric'), t('memo.colTier'), t('memo.colReason')], nsCols),
        ...notScored.map((r, i) => {
          const displayName = (lang === 'fr' && r.metric_name_fr) ? r.metric_name_fr : r.metric_name;
          return wDataRow([displayName, tTier(r.tier, t), statusLabelT(r.status, t)], nsCols, i % 2 === 1);
        }),
      ],
    }), wSpacer(200));
  }

  // ── Analyst Commentary ──
  const summaryRaw  = lang === 'fr' ? (data.score?.summary_fr ?? data.score?.summary) : data.score?.summary;
  const summaryText = summaryRaw?.trim();
  if (summaryText) {
    children.push(wHead1(t('memo.secAnalystCommentary').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));
    splitIntoParagraphs(summaryText).forEach(p => children.push(wPara(p, { spaceAfter: 160 })));
  }

  // ── Strengths & Risks ──
  const strengths = (lang === 'fr' ? (data.score?.strengths_fr ?? data.score?.strengths) : data.score?.strengths) ?? [];
  const risks     = (lang === 'fr' ? (data.score?.risks_fr     ?? data.score?.risks)     : data.score?.risks)     ?? [];
  if (strengths.length || risks.length) {
    children.push(wHead1(t('memo.secStrengthsRisks').replace(/^[A-Z &]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));
    if (strengths.length) {
      children.push(wHead2(t('memo.keyStrengths')));
      // keepNext on all bullets except the last keeps the list from splitting mid-way
      strengths.forEach((s, i) => children.push(wBullet(s, STRONG.replace('#', ''), i < strengths.length - 1)));
    }
    if (risks.length) {
      // wHead2 has keepNext: true, binding it to the first bullet
      children.push(wHead2(t('memo.keyRisks')));
      risks.forEach((r, i) => children.push(wBullet(r, RED.replace('#', ''), i < risks.length - 1)));
    }
    children.push(wSpacer(160));
  }

  // ── Historical Benchmark ──
  {
    const bm       = data.benchmarks;
    const csbfp    = bm?.csbfp;
    const hasCsbfp = !!csbfp;
    const hasSba   = !bm?.noMapping && !!(bm?.base?.sector && bm?.stress?.sector);

    if (hasCsbfp || hasSba) {
      children.push(wHead1(t('memo.secHistoricalBenchmark').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));

      // ── Canada sub-section ──
      if (hasCsbfp) {
        const cIndLabel = (data.deal.industry ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Sector';
        const drPct  = (csbfp!.defaultRate * 100).toFixed(1) + '%';
        const lrPct  = (csbfp!.lossRate   * 100).toFixed(1) + '%';
        const drDenom = nLoans(csbfp!.totalLoans);
        const lrDenom = t('memo.csbfpOfLent').replace('{amount}', fmtDollarsKW(csbfp!.totalLoanValue));

        const cCols = [2200, TW_CONT - 2200];

        children.push(wHead2(t('memo.canadaCSBFP')));
        // Industry label above table
        children.push(wPara(t('memo.csbfpSectorLabel').replace('{name}', cIndLabel), { bold: true, color: NAVY.replace('#', ''), spaceAfter: 80, keepNext: true }));

        const cHdrRow = new TableRow({
          tableHeader: true, cantSplit: true,
          children: [
            new TableCell({ width: { size: cCols[0], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: t('memo.colMetric'), bold: true, size: 18, color: NAVY.replace('#', '') })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: cCols[1], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: t('memo.csbfpCumulative'), bold: true, size: 18, color: NAVY.replace('#', '') })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
          ],
        });

        function cDataRow(metric: string, ratePct: string, denom: string, shaded = false): any {
          const fill = shaded ? 'F8F6F3' : 'FFFFFF';
          return new TableRow({ cantSplit: true, children: [
            new TableCell({ width: { size: cCols[0], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: metric, size: 18, font: 'Calibri' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: cCols[1], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
              children: [
                new Paragraph({ children: [new TextRun({ text: ratePct, bold: true, size: 24, color: NAVY.replace('#', ''), font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 20 } }),
                new Paragraph({ children: [new TextRun({ text: denom, size: 16, color: '888888', font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
              ] }),
          ]});
        }

        children.push(new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: [
          cHdrRow,
          cDataRow(t('memo.csbfpLoansDefaulted'),  drPct, drDenom),
          cDataRow(t('memo.csbfpLoanedValueLost'),  lrPct, lrDenom, true),
        ]}), wSpacer(80));

        if (!csbfp!.reliable) {
          children.push(wPara(t('memo.csbfpSmallSample'), { italics: true, color: '888888', spaceAfter: 40 }));
        }
        children.push(wPara(t('memo.csbfpHistory'), { color: '888888', spaceAfter: 120 }));
      }

      // ── Separator note ──
      if (hasCsbfp && hasSba) {
        children.push(wPara(t('memo.benchmarkComparability'), { italics: true, color: '888888', spaceAfter: 120, keepNext: true }));
      }

      // ── US sub-section ──
      if (hasSba) {
        const { base, stress, totalN } = bm!;
        const industryLabel = (data.deal.industry ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Sector';
        const baseLGD   = Math.round(base!.sector!.lgd  * 100);
        const stressLGD = Math.round(stress!.sector!.lgd * 100);
        const dealSB    = sbaBand(data.deal.amount_requested ?? 0);
        const dealTB    = sbaTermBand(data.deal.term_months ?? 0);
        const hasSegment = !!(base?.segment && stress?.segment);

        children.push(wHead2(t('memo.usSba')));

        const bmCols = [2200, 1700, 1700];
        const bmHdrRow = new TableRow({
          tableHeader: true, cantSplit: true,
          children: [
            new TableCell({ width: { size: bmCols[0], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: t('memo.colSegment'), bold: true, size: 18, color: NAVY.replace('#', '') })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: bmCols[1], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: t('memo.sbaLoansDefaultedNormal'), size: 17, color: NAVY.replace('#', '') })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })] }),
            new TableCell({ width: { size: bmCols[2], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: t('memo.sbaLoansDefaultedStress'), size: 17, color: RED.replace('#', '') })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })] }),
          ],
        });

        function bmDataRowW(segLabel: string, baseDR: number, baseN: number, stressDR: number, stressN: number, shaded = false): any {
          const fill = shaded ? 'F8F6F3' : 'FFFFFF';
          return new TableRow({ cantSplit: true, children: [
            new TableCell({ width: { size: bmCols[0], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: segLabel, bold: !shaded, size: 18, font: 'Calibri' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: bmCols[1], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: `${pct(baseDR)} ${nLoans(baseN)}`, size: 18, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
            new TableCell({ width: { size: bmCols[2], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
              children: [new Paragraph({ children: [new TextRun({ text: `${pct(stressDR)} ${nLoans(stressN)}`, size: 18, color: RED.replace('#', ''), font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
          ]});
        }

        children.push(new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: [
          bmHdrRow,
          bmDataRowW(t('memo.csbfpSectorLabel').replace('{name}', industryLabel), base!.sector!.default_rate, base!.sector!.n_loans, stress!.sector!.default_rate, stress!.sector!.n_loans),
          ...(hasSegment ? [bmDataRowW(`${dealSB} · ${dealTB}`, base!.segment!.default_rate, base!.segment!.n_loans, stress!.segment!.default_rate, stress!.segment!.n_loans, true)] : []),
        ]}), wSpacer(160));

        if (hasSegment && base?.sector?.default_rate) {
          const ratio = base!.segment!.default_rate / base!.sector!.default_rate;
          if (ratio >= 1.3 || ratio <= 0.75) {
            const msg = ratio >= 1.3 ? t('memo.sbaHigherDefault') : t('memo.sbaLowerDefault');
            children.push(wPara(msg, { italics: true, spaceAfter: 120, keepNext: true }));
          }
        }

        const lgdText = t('memo.lgdText').replace('{base}', String(baseLGD)).replace('{stress}', String(stressLGD));
        const lgdCtx  = t('memo.lgdContext').replace('{n}', (totalN ?? 0).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'));

        children.push(
          wPara(t('memo.lgdTitle'), { bold: true, spaceAfter: 60, keepNext: true }),
          wPara(lgdText, { spaceAfter: 120, keepNext: true }),
          wPara(lgdCtx, { italics: true, color: '888888', spaceAfter: 200 }),
        );
      }
    }
  }

  // ── Sources & Uses ──
  const suEntries = data.suEntries ?? [];
  if (suEntries.length) {
    const uses   = suEntries.filter(e => e.side === 'use');
    const srcs   = suEntries.filter(e => e.side === 'source');
    const totalU = uses.reduce((s, e) => s + Number(e.amount), 0);
    const totalS = srcs.reduce((s, e) => s + Number(e.amount), 0);
    const suCols = [2400, 1000, 2400, 1000];
    const maxLen = Math.max(uses.length, srcs.length);
    const suRows: any[] = [wHdrRow([t('memo.colUseOfFunds'), t('memo.colAmount'), t('memo.colSourceOfFunds'), t('memo.colAmount')], suCols)];
    for (let i = 0; i < maxLen; i++) {
      suRows.push(wDataRow([uses[i]?.label ?? '', uses[i] ? fmt(Number(uses[i].amount)) : '', srcs[i]?.label ?? '', srcs[i] ? fmt(Number(srcs[i].amount)) : ''], suCols, i % 2 === 1));
    }
    suRows.push(wTotalRow([t('memo.totalUses'), fmt(totalU), t('memo.totalSources'), fmt(totalS)], suCols));
    children.push(wHead1(t('memo.secSourcesUses').replace(/^[A-Z &]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())), new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: suRows }), wSpacer(200));
  }

  // ── Capitalization ──
  const capItems = data.capItems ?? [];
  if (capItems.length) {
    const ebitdaVal  = Number(data.deal?.ebitda);
    const hasEbitda  = ebitdaVal > 0;
    const cashVal    = Number(data.confirmedCash) || 0;
    const rl         = data.deal?.revolver_limit  != null ? Number(data.deal.revolver_limit)  : null;
    const rd         = data.deal?.revolver_drawn  != null ? Number(data.deal.revolver_drawn)   : null;
    const evProv     = data.deal?.enterprise_value != null ? Number(data.deal.enterprise_value) : null;

    const sorted     = [...capItems].sort((a, b) => (CAT_ORDER[a.category] ?? 99) - (CAT_ORDER[b.category] ?? 99));
    const totalCap   = capItems.reduce((s, r) => s + Number(r.amount), 0);
    const totalDebt  = capItems.filter(r => DEBT_CATS.includes(r.category)).reduce((s, r) => s + Number(r.amount), 0);
    const seniorDebt = capItems.filter(r => r.category === 'Senior Debt').reduce((s, r) => s + Number(r.amount), 0);
    const totalEquity= totalCap - totalDebt;
    const netDebt    = totalDebt - cashVal;
    const availLiq   = cashVal + (rl != null ? (rl - (rd ?? 0)) : 0);
    const evProxy    = totalCap - cashVal;

    const capColsW = hasEbitda ? [2200, 900, 1050, 850, 850] : [2600, 1000, 1200, 1060];
    const capHdrLabels = [t('memo.colInstrument'), t('memo.colCategory'), t('memo.colAmount'), t('memo.colPctOfCap'), ...(hasEbitda ? [t('memo.colTimesEbitda')] : [])];

    let cumDebt2 = 0;
    const capRows: any[] = [wHdrRow(capHdrLabels, capColsW)];
    sorted.forEach((r, i) => {
      const amt    = Number(r.amount);
      const pctCap = totalCap > 0 ? `${(amt / totalCap * 100).toFixed(1)}%` : '—';
      let xE = '—';
      if (hasEbitda && DEBT_CATS.includes(r.category)) { cumDebt2 += amt; xE = `${(cumDebt2 / ebitdaVal).toFixed(2)}x`; }
      capRows.push(wDataRow([r.label, r.category, fmt(amt), pctCap, ...(hasEbitda ? [xE] : [])], capColsW, i % 2 === 1));
    });
    const debtRow  = [t('memo.totalDebt'),  '', fmt(totalDebt),  totalCap > 0 ? `${(totalDebt /totalCap*100).toFixed(1)}%` : '—', ...(hasEbitda ? [totalDebt  > 0 ? `${(totalDebt /ebitdaVal).toFixed(2)}x` : '—'] : [])];
    const eqRow    = [t('memo.totalEquity'),'', fmt(totalEquity),totalCap > 0 ? `${(totalEquity/totalCap*100).toFixed(1)}%` : '—', ...(hasEbitda ? ['—'] : [])];
    const totalRow = [t('memo.totalCapitalization'),'', fmt(totalCap),'100%', ...(hasEbitda ? [totalDebt > 0 ? `${(totalDebt/ebitdaVal).toFixed(2)}x` : '—'] : [])];
    capRows.push(wTotalRow(debtRow,  capColsW, 'FAFAF9'));
    capRows.push(wTotalRow(eqRow,    capColsW, 'FAFAF9'));
    capRows.push(wTotalRow(totalRow, capColsW, 'E8E2D9'));

    const creditMetrics: Array<{ label: string; value: string }> = [
      { label: t('memo.capSeniorDebtEbitda'),  value: hasEbitda && seniorDebt > 0 ? `${(seniorDebt/ebitdaVal).toFixed(2)}x` : 'n/m' },
      { label: t('memo.capTotalDebtEbitda'),   value: hasEbitda ? `${(totalDebt/ebitdaVal).toFixed(2)}x` : 'n/m' },
      { label: t('memo.capNetDebtEbitda'),     value: hasEbitda ? `${(netDebt/ebitdaVal).toFixed(2)}x` : 'n/m' },
      ...(rl != null ? [{ label: t('memo.capRevolverLimit'), value: fmt(rl) }] : []),
      { label: rl == null ? t('memo.capAvailLiqCashOnly') : t('memo.capAvailLiq'), value: fmt(availLiq) },
      evProv != null ? { label: t('memo.capEvProvided'), value: fmt(evProv) }
        : totalEquity > 0 ? { label: t('memo.capEvProxy'), value: fmt(evProxy) }
        : { label: t('memo.capEvProxyNm'), value: t('memo.capNmAddEquity') },
      { label: t('memo.capDebtTotalCap'), value: totalCap > 0 ? `${(totalDebt/totalCap*100).toFixed(1)}%` : '—' },
    ];
    const mCols2 = [6200, 2460];
    const mRows  = creditMetrics.map((m, i) => wDataRow([m.label, m.value], mCols2, i % 2 === 1));

    const ebitdaRef = hasEbitda ? `${t('memo.capEbitdaRef').replace('{amount}', fmt(ebitdaVal))}${cashVal > 0 ? `  ·  ${t('memo.capCashRef').replace('{amount}', fmt(cashVal))}` : ''}` : '';

    children.push(
      wHead1(t('memo.secCapitalization').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())),
      wPara(t('memo.proFormaNote'), { italics: true, color: '888888', spaceAfter: 120, keepNext: true }),
      new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: capRows }),
      wSpacer(160),
      wHead2(t('memo.secCreditMetrics')),
      new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: mRows }),
      ...(hasEbitda ? [wSpacer(80), wPara(ebitdaRef, { italics: true, color: '888888', spaceAfter: 0 })] : []),
      wSpacer(200),
    );
  }

  // ── Collateral ──
  const collateral = data.collateral ?? [];
  if (collateral.length) {
    const collCols = [1300, 2100, 1440, 1200, 1620];
    const totalL   = collateral.reduce((s, it) => s + Number(it.lending_value), 0);
    children.push(wHead1(t('memo.secCollateral').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())), new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: [
      wHdrRow([t('memo.colAssetType'), t('memo.colDescription'), t('memo.colMarketValue'), t('memo.colAdvanceRate'), t('memo.colLendingValue')], collCols),
      ...collateral.map((it, i) => wDataRow([it.asset_type, it.description ?? '—', fmt(Number(it.market_value)), `${Math.round((it.advance_rate ?? 0)*100)}%`, fmt(Number(it.lending_value))], collCols, i % 2 === 1)),
      wTotalRow([t('memo.totalLendingValue'), '', '', '', fmt(totalL)], collCols),
    ]}), wSpacer(200));
  }

  // ── Diligence Questions ──
  if (questions.length) {
    children.push(wPageBreak(), wHead1(t('memo.secAnnexA').replace(/^[A-Z —]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));
    questions.forEach((q, i) => {
      const tag = [q.priority?.toUpperCase(), q.source].filter(Boolean).join(' · ');
      const qText = (lang === 'fr' && q.question_text_fr) ? q.question_text_fr : q.question_text;
      // keepNext chains the question lines together so they don't split across pages.
      children.push(wPara(`Q${i + 1}. ${qText}${tag ? `  [${tag}]` : ''}`, { bold: true, spaceAfter: 60, keepNext: true }));
      if (q.related_metric) children.push(wPara(t('memo.related').replace('{metric}', q.related_metric), { italics: true, color: '888888', spaceAfter: 60, keepNext: true }));
      if (q.answer?.trim()) {
        children.push(
          wPara(t('memo.response'), { bold: true, spaceAfter: 40, keepNext: true }),
          wPara(q.answer.trim(), { spaceAfter: 60, keepNext: !!q.answer_assessment?.trim() }),
        );
        if (q.answer_assessment?.trim()) children.push(wPara(t('memo.assessment').replace('{text}', q.answer_assessment.trim()), { italics: true, color: '888888', spaceAfter: 60 }));
      } else {
        children.push(wPara(t('memo.statusLabel').replace('{text}', q.status ?? t('memo.pending')), { italics: true, color: '888888', spaceAfter: 60 }));
      }
      if (i < questions.length - 1) children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D8D2C8' } }, spacing: { after: 120 } }));
    });
    children.push(wSpacer(240));
  }

  // ── Methodology ──
  children.push(wPageBreak(), wHead1(t('memo.secMethodology').replace(/^[A-Z ]+$/, s => s.charAt(0) + s.slice(1).toLowerCase())));

  // ── How This Score Was Calculated ──
  {
    const { tiers: wTiers, totalWeightedPoints: wTWP, totalWeight: wTW, computedScore: wCS } = calcScoreBreakdown(data.metrics);
    const wStored     = data.score?.overall_score ?? null;
    const wReconciled = wCS != null && wStored != null && wCS === wStored;

    children.push(wHead2(t('memo.howScoreCalc')));
    children.push(wPara(t('memo.scoreLeadIn'), { spaceAfter: 120, keepNext: true }));

    // Grade points reference table
    const gCols = [3500, 1500];
    children.push(
      wPara(t('memo.gradePoints'), { bold: true, spaceAfter: 60, keepNext: true }),
      new Table({ width: { size: 5000, type: WidthType.DXA }, rows: [
        wHdrRow([t('memo.gradePoints').split(' → ')[0], 'Points'], gCols),
        wDataRow([t('memo.gradeStrong'),   '100'], gCols),
        wDataRow([t('memo.gradeAdequate'),  '60'], gCols, true),
        wDataRow([t('memo.gradeWeak'),      '20'], gCols),
      ]}),
      wSpacer(100),
      wPara(t('memo.tierWeight'), { bold: true, spaceAfter: 60, keepNext: true }),
      new Table({ width: { size: 5000, type: WidthType.DXA }, rows: [
        wHdrRow([t('memo.tierWeight').split(' → ')[0], 'Weight'], gCols),
        wDataRow([t('memo.tierCritical'),      '3.0'], gCols),
        wDataRow([t('memo.tierImportant'),     '2.0'], gCols, true),
        wDataRow([t('memo.tierSupplementary'), '1.0'], gCols),
        wDataRow([t('memo.tierOptional'),      '0.5'], gCols, true),
      ]}),
      wSpacer(160),
    );

    // Deal-specific calculation table
    if (wTiers.length === 0) {
      children.push(wPara(t('memo.insufficientMetrics'), { italics: true, color: '888888', spaceAfter: 120 }));
    } else if (!wReconciled) {
      children.push(wPara(t('memo.reconcileNote'), { italics: true, color: AMBER.replace('#', ''), spaceAfter: 120 }));
    } else {
      const wTotalCount = wTiers.reduce((s, tt) => s + tt.strong + tt.adequate + tt.weak, 0);
      children.push(wPara(t('memo.scoreCalcDeal').replace('{n}', String(wTotalCount)), { bold: true, spaceAfter: 80, keepNext: true }));
      const cCols = [2200, 860, 760, 900, 1060, 760, 3540]; // sum = 10080
      const calcTableRows: any[] = [wHdrRow([t('memo.colTier'), 'Weight', t('memo.colCount'), t('memo.gradeStrong'), t('memo.gradeAdequate'), t('memo.gradeWeak'), t('memo.colWtdPoints')], cCols)];
      wTiers.forEach((tt, i) => {
        calcTableRows.push(wDataRow([
          tTier(tt.tier, t), tt.weight.toFixed(1), String(tt.strong + tt.adequate + tt.weak),
          String(tt.strong), String(tt.adequate), String(tt.weak),
          tt.weightedPoints.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US'),
        ], cCols, i % 2 === 1));
      });
      calcTableRows.push(wTotalRow([t('memo.totals'), '', String(wTotalCount), '', '', '', wTWP.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US')], cCols));
      children.push(new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: calcTableRows }), wSpacer(100));

      const wRawExact   = wTWP / wTW;
      const wIsExact    = Math.round(wRawExact * 10) / 10 === wRawExact && wRawExact === Math.floor(wRawExact * 10) / 10;
      const wRawDisplay = wIsExact ? String(wCS) : wRawExact.toFixed(3) + '…';
      const wTWStr      = wTW % 1 === 0 ? wTW.toFixed(0) : wTW.toFixed(1);
      children.push(wPara(`${wTWP.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-US')} ÷ ${wTWStr} = ${wRawDisplay} → ${wCS}`, { bold: true, spaceAfter: 160 }));
    }

    // Critical floor
    children.push(wPara(t('memo.criticalFloorLabel'), { bold: true, spaceAfter: 60, keepNext: true }));
    children.push(wPara(t('memo.criticalFloorDesc'), { spaceAfter: 80, keepNext: true }));
    if (data.score?.critical_floor_applied) {
      const why = data.score.capped_reason === 'severe_critical' ? t('memo.floorAppliedSevere') : t('memo.floorAppliedWeak');
      children.push(wPara(`${t('memo.forThisDeal')}${t('memo.floorAppliedDeal').replace('{why}', why)}`, { color: RED.replace('#', ''), spaceAfter: 120 }));
    } else {
      children.push(wPara(`${t('memo.forThisDeal')}${t('memo.floorNotAppliedDeal')}`, { color: STRONG.replace('#', ''), spaceAfter: 120 }));
    }

    // Lender note
    children.push(wPara(t('memo.lenderConfig'), { italics: true, color: '888888', spaceAfter: 200 }));
  }

  children.push(
    wHead2(t('memo.secScoringFramework')),
    wPara(t('memo.scoringFrameworkText'), { spaceAfter: 160 }),
    wHead2(t('memo.secMetricTiers')),
    wPara(t('memo.metricTiersText'), { spaceAfter: 160 }),
    wHead2(t('memo.secDisclaimer')),
    wPara(t('memo.disclaimerText'), { italics: true, color: '888888', spaceAfter: 0 }),
  );

  const borrower = data.deal.title ?? 'Credit Memorandum';
  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: TWIP_PG, height: 15840 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: {
        default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: `${borrower}     ${t('memo.confidentialHeader')}`, size: 16, color: '888888', font: 'Calibri' })], spacing: { after: 0 } })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', size: 16, color: '888888' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }), new TextRun({ text: ' of ', size: 16, color: '888888' }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '888888' })], spacing: { before: 0, after: 0 } })] }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = memoFilename(data.deal.title, 'docx', lang, t);
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
