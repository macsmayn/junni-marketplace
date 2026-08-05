// Credit memo export — PDF (pdfmake 0.3) and Word (docx 9)
// Fraunces Bold is fetched from @fontsource at PDF-generation time and embedded.

import frauncesWoffUrl from '@fontsource/fraunces/files/fraunces-latin-700-normal.woff?url';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemoMetric {
  metric_name: string;
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
  answer?: string | null;
  status?: string;
  priority?: string;
  source?: string;
  related_metric?: string | null;
  answer_assessment?: string | null;
}

export interface MemoData {
  deal: {
    title?: string | null;
    industry?: string | null;
    city?: string | null;
    province?: string | null;
    amount_requested?: number | null;
    term_months?: number | null;
    interest_rate?: number | null;
    executive_summary?: string | null;
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
    strengths?: string[] | null;
    risks?: string[] | null;
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
  } | null;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const NAVY   = '#1B2B4B';
const GOLD   = '#C49A45';
const STRONG = '#1B5E20';
const AMBER  = '#E65100';
const RED    = '#B71C1C';
const MUTED  = '#888888';

const DEBT_CATS = ['Senior Debt', 'Subordinated Debt', 'Shareholder Loans'];
const CAT_ORDER: Record<string, number> = {
  'Senior Debt': 0, 'Subordinated Debt': 1, 'Shareholder Loans': 2,
  'Preferred Equity': 3, 'Common Equity': 4, 'Other': 5,
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.round(Math.abs(n));
  const s = '$' + abs.toLocaleString('en-US');
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

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    needs_input:             'Data not available',
    needs_review:            'Degenerate (negative base)',
    qualitative:             'Qualitative — external judgment',
    needs_document_or_input: 'Awaiting documentation',
    excluded:                'Excluded',
  };
  return m[s?.toLowerCase() ?? ''] ?? (s ?? '—');
}

function pct(r: number | null | undefined): string {
  if (r == null) return '—';
  return `${(r * 100).toFixed(1)}%`;
}

function isoDate(): string { return new Date().toLocaleDateString('en-CA'); }

function memoFilename(title: string | null | undefined, ext: string): string {
  const base = (title ?? 'Credit_Memo').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'Credit_Memo';
  return `${base}_Credit_Memo_${isoDate()}.${ext}`;
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
function pdfScoredMetricsTable(rows: MemoMetric[]): any {
  const hdr = ['Metric', 'Tier', 'Value', 'Grade', 'Strong', 'Adequate', 'Weak'].map(t => hdrCell(t));
  const body = rows.map((r, i) => {
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(r.metric_name, {}, bg),
      cell(r.tier, { fontSize: 7.5, color: MUTED }, bg),
      cell(fmtVal(r.value, r.metric_name), {}, bg),
      cell(r.grade, { bold: true, color: gradeColor(r.grade) }, bg),
      cell(r.strong_band,   { fontSize: 7.5, color: STRONG }, bg),
      cell(r.adequate_band, { fontSize: 7.5, color: AMBER  }, bg),
      cell(r.weak_band,     { fontSize: 7.5, color: RED    }, bg),
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

function pdfCover(data: MemoData): any[] {
  const loc = [data.deal.city, data.deal.province].filter(Boolean).join(', ');
  const loanParts = [
    data.deal.amount_requested ? fmtMoney(data.deal.amount_requested) + ' requested' : null,
    data.deal.term_months      ? `${data.deal.term_months}-month term` : null,
    data.deal.interest_rate    ? `${data.deal.interest_rate}% p.a.` : null,
  ].filter(Boolean);

  const scoreBlock = data.score?.overall_score != null ? [
    { text: ' ', margin: [0, 24, 0, 0] },
    { text: 'Credit Score', fontSize: 10, color: MUTED, margin: [0, 0, 0, 4] },
    {
      text: `${data.score.overall_score}${data.score.risk_label ? '  —  ' + data.score.risk_label : ''}`,
      font: 'Fraunces', bold: true, fontSize: 30, color: NAVY, margin: [0, 0, 0, 0],
    },
  ] : [];

  return [
    { text: ' ', fontSize: 44, margin: [0, 36, 0, 0] },
    { text: data.deal.title ?? 'Credit Memorandum', font: 'Fraunces', bold: true, fontSize: 28, color: NAVY, margin: [0, 0, 0, 8] },
    ...(data.deal.industry ? [{ text: `Industry: ${data.deal.industry}`, fontSize: 12, color: MUTED, margin: [0, 0, 0, 4] }] : []),
    ...(loc ? [{ text: loc, fontSize: 11, color: MUTED, margin: [0, 0, 0, 0] }] : []),
    ...(data.deal.years_in_business != null ? [{ text: `${data.deal.years_in_business} years in operation`, fontSize: 10, color: MUTED, margin: [0, 2, 0, 0] }] : []),
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 1.5, lineColor: GOLD }], margin: [0, 18, 0, 18] },
    ...(loanParts.length ? [{ text: loanParts.join('  ·  '), fontSize: 12, color: NAVY, margin: [0, 0, 0, 0] }] : []),
    ...scoreBlock,
    { text: isoDate(), fontSize: 18, color: MUTED, margin: [0, 32, 0, 0] },
    { text: '', pageBreak: 'after', margin: [0, 0, 0, 0] },
  ];
}

function pdfExecSummary(data: MemoData): any[] {
  const text = data.deal.executive_summary?.trim();
  if (!text) return [];
  const paras = splitIntoParagraphs(text);
  return [
    pdfSection('EXECUTIVE SUMMARY'),
    ...paras.map((p, i) => ({
      text: p, fontSize: 9, lineHeight: 1.55,
      margin: [0, 0, 0, i < paras.length - 1 ? 8 : 0],
      ...(i === paras.length - 1 ? { pageBreak: 'after' } : {}),
    })),
  ];
}

function pdfMetrics(data: MemoData): any[] {
  const scored    = data.metrics.filter(m => m.counted);
  const notScored = data.metrics.filter(m => !m.counted);

  const out: any[] = [];

  // Section heading + notes in an unbreakable block — prevents the heading from
  // sitting alone at the bottom of a page without any content beneath it.
  const headGroup: any[] = [pdfSection('FINANCIAL METRICS')];
  if (data.score?.coverage_pct != null) {
    headGroup.push({ text: `Metric coverage: ${data.score.coverage_pct}% of the scoring framework was computable from the financial statements provided.`, fontSize: 8.5, color: MUTED, italics: true, margin: [0, 0, 0, 10] });
  }
  if (data.score?.critical_floor_applied) {
    headGroup.push({ text: `Note: Critical-metric floor applied — overall score capped at 49. ${data.score.capped_reason ?? ''}`.trim(), fontSize: 8.5, color: RED, italics: true, margin: [0, 0, 0, 10] });
  }
  if (scored.length > 0) headGroup.push(pdfSubHead('Scored Metrics'));
  out.push({ stack: headGroup, unbreakable: true });

  // Scored table is intentionally breakable (can exceed one page with 17+ rows).
  // headerRows: 1 repeats the column header on each continuation page.
  if (scored.length > 0) out.push(pdfScoredMetricsTable(scored));

  // Not-scored table: small, keep heading + table together.
  if (notScored.length > 0) {
    const nsHdr  = ['Metric', 'Tier', 'Reason'].map(t => hdrCell(t));
    const nsRows = notScored.map((r, i) => {
      const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
      return [cell(r.metric_name, {}, bg), cell(r.tier, { fontSize: 7.5, color: MUTED }, bg), cell(statusLabel(r.status), { fontSize: 8, color: MUTED }, bg)];
    });
    const nsTable = { table: { widths: ['*', 70, '*'], headerRows: 1, body: [nsHdr, ...nsRows] }, layout: thinLayout, margin: [0, 0, 0, 6] };
    out.push({ stack: [pdfSubHead('Not Scored'), nsTable], unbreakable: true });
  }

  return out;
}

function pdfAnalystCommentary(data: MemoData): any[] {
  const text = data.score?.summary?.trim();
  if (!text) return [];
  const paras = splitIntoParagraphs(text);
  return [
    pdfSection('ANALYST COMMENTARY'),
    ...paras.map((p, i) => ({ text: p, fontSize: 9, lineHeight: 1.55, margin: [0, 0, 0, i < paras.length - 1 ? 10 : 0] })),
  ];
}

function pdfStrengthsRisks(data: MemoData): any[] {
  const s = data.score?.strengths ?? [];
  const r = data.score?.risks ?? [];
  if (!s.length && !r.length) return [];

  const sectionHead = pdfSection('STRENGTHS & RISKS');
  const out: any[] = [];

  // Each list is a separate unbreakable block so Risks can move pages independently.
  // The section heading attaches to whichever list comes first.
  if (s.length) {
    out.push({ stack: [sectionHead, pdfSubHead('Key Strengths'), ...pdfBullets(s, STRONG)], unbreakable: true });
  }
  if (r.length) {
    // If there were no strengths, the section heading needs to travel with risks.
    const risksStack = s.length
      ? [pdfSubHead('Key Risks'), ...pdfBullets(r, RED)]
      : [sectionHead, pdfSubHead('Key Risks'), ...pdfBullets(r, RED)];
    out.push({ stack: risksStack, unbreakable: true });
  }

  return out;
}

function pdfBenchmark(data: MemoData): any[] {
  const bm = data.benchmarks;
  if (!bm || bm.noMapping || !bm.base?.sector) return [];
  const { base, stress, totalN } = bm;
  const hasSector  = base?.sector && stress?.sector;
  const hasSegment = base?.segment && stress?.segment;
  if (!hasSector) return [];

  const industryLabel = (data.deal.industry ?? '').replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || 'Sector';
  const dealSB = sbaBand(data.deal.amount_requested ?? 0);
  const dealTB = sbaTermBand(data.deal.term_months ?? 0);

  const baseLGD   = Math.round(base!.sector!.lgd  * 100);
  const stressLGD = Math.round(stress!.sector!.lgd * 100);

  const tableHdr = [
    { text: 'Segment', bold: true, fontSize: 8.5, color: NAVY, fillColor: '#F0EDE8', margin: [4, 5, 4, 5] },
    {
      stack: [
        { text: 'Loans that defaulted', bold: true, fontSize: 8.5, color: NAVY },
        { text: 'Normal cycle · FY2010–2016', fontSize: 7.5, color: MUTED },
      ],
      fillColor: '#F0EDE8', margin: [4, 5, 4, 5], alignment: 'center',
    },
    {
      stack: [
        { text: 'Loans that defaulted', bold: true, fontSize: 8.5, color: RED },
        { text: '2008 downturn · FY2004–2008', fontSize: 7.5, color: MUTED },
      ],
      fillColor: '#F0EDE8', margin: [4, 5, 4, 5], alignment: 'center',
    },
  ];

  function bmDataCell(dr: number | null | undefined, n: number | null | undefined, color: string, bg?: string): any {
    return {
      stack: [
        { text: pct(dr), bold: true, fontSize: 14, color },
        { text: `of ${(n ?? 0).toLocaleString('en-US')} loans`, fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] },
      ],
      alignment: 'center', fillColor: bg ?? null, margin: [4, 6, 4, 6],
    };
  }

  const tableRows: any[][] = [tableHdr];
  tableRows.push([
    cell(`${industryLabel} sector`, { bold: true }),
    bmDataCell(base!.sector!.default_rate, base!.sector!.n_loans, NAVY),
    bmDataCell(stress!.sector!.default_rate, stress!.sector!.n_loans, RED),
  ]);
  if (hasSegment) {
    tableRows.push([
      { stack: [{ text: `${dealSB} · ${dealTB}`, bold: true, fontSize: 8.5 }, { text: 'Loans of similar size and term', fontSize: 7.5, color: MUTED }], fillColor: '#F8F6F3', margin: [4, 4, 4, 4] },
      bmDataCell(base!.segment!.default_rate, base!.segment!.n_loans, NAVY, '#F8F6F3'),
      bmDataCell(stress!.segment!.default_rate, stress!.segment!.n_loans, RED, '#F8F6F3'),
    ]);
  }

  const bmTableNode = {
    table: { widths: ['*', 140, 140], headerRows: 1, body: tableRows },
    layout: { ...thinLayout, hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0 : 0.5 },
    margin: [0, 0, 0, 12],
  };

  // Interpretive sentence (gold-bar callout)
  let interpretiveNode: any = null;
  if (hasSegment && base?.sector?.default_rate) {
    const ratio = base!.segment!.default_rate / base!.sector!.default_rate;
    if (ratio >= 1.3 || ratio <= 0.75) {
      const msg = ratio >= 1.3
        ? 'Loans of this size and term defaulted notably more often than the sector as a whole. In SBA lending, shorter terms are typically associated with working-capital facilities and younger or thinner-margin businesses, so this pattern likely reflects the type of borrower that seeks these terms rather than the loan structure itself.'
        : 'Loans of this size and term defaulted less often than the sector as a whole. Longer amortisation and larger facilities generally indicate established borrowers with harder collateral, which historically supported better repayment performance.';
      interpretiveNode = {
        table: {
          widths: [3, '*'],
          body: [[
            { text: '', fillColor: GOLD, border: [false, false, false, false] },
            { text: msg, fontSize: 8.5, lineHeight: 1.5, margin: [8, 4, 4, 4], border: [false, false, false, false] },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 12],
      };
    }
  }

  const lgdLabel = { text: 'LOSS GIVEN DEFAULT', bold: true, fontSize: 8, color: MUTED, margin: [0, 4, 0, 4], characterSpacing: 1 };
  const lgdPara  = {
    text: [
      'When these loans did fail, lenders lost about ',
      { text: `~${baseLGD} cents on every dollar owed`, bold: true },
      ' in a normal cycle — and about ',
      { text: `~${stressLGD} cents`, bold: true, color: RED },
      ' in the 2008 downturn, because collateral was worth less at the same time defaults rose.',
    ],
    fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 10],
  };
  const caveat = {
    text: `This benchmark comes from ${(totalN ?? 0).toLocaleString('en-US')} comparable loans within a dataset of 698,000 U.S. Small Business Administration 7(a) loans that have fully run their course. The normal-cycle figures cover loans approved between 2010 and 2016; the downturn figures cover loans approved between 2004 and 2008, which absorbed the financial crisis. This is U.S. small-business lending data shown for context. It describes how similar loans performed in the past — it is not a prediction about this borrower.`,
    fontSize: 8, color: MUTED, lineHeight: 1.5,
  };

  // The whole benchmark section — heading + table + interpretive + LGD + caveat —
  // stays together as one unbreakable block.
  const blockItems = [
    pdfSection('HISTORICAL BENCHMARK — SBA 7(a) LOAN DATA'),
    bmTableNode,
    ...(interpretiveNode ? [interpretiveNode] : []),
    lgdLabel,
    lgdPara,
    caveat,
  ];
  return [{ stack: blockItems, unbreakable: true }];
}

function pdfSourcesUses(data: MemoData): any[] {
  const entries = data.suEntries ?? [];
  if (!entries.length) return [];

  const uses   = entries.filter(e => e.side === 'use');
  const srcs   = entries.filter(e => e.side === 'source');
  const totalU = uses.reduce((s, e) => s + Number(e.amount), 0);
  const totalS = srcs.reduce((s, e) => s + Number(e.amount), 0);
  const maxLen = Math.max(uses.length, srcs.length);

  const subHdr = [
    { text: 'USES',    bold: true, fontSize: 8, color: MUTED, fillColor: '#F0EDE8', margin: [4, 4, 4, 4], colSpan: 2 }, {},
    { text: 'SOURCES', bold: true, fontSize: 8, color: MUTED, fillColor: '#F0EDE8', margin: [4, 4, 4, 4], colSpan: 2 }, {},
  ];
  const rows = Array.from({ length: maxLen }, (_, i) => {
    const u = uses[i]; const s = srcs[i];
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(u?.label ?? '', {}, bg),
      cell(u ? fmtMoney(Number(u.amount)) : '', { alignment: 'right' }, bg),
      cell(s?.label ?? '', {}, bg),
      cell(s ? fmtMoney(Number(s.amount)) : '', { alignment: 'right' }, bg),
    ];
  });
  rows.push([
    cell('Total Uses',    { bold: true, fontSize: 9 }, '#E8E2D9'),
    cell(fmtMoney(totalU), { bold: true, alignment: 'right', fontSize: 9 }, '#E8E2D9'),
    cell('Total Sources', { bold: true, fontSize: 9 }, '#E8E2D9'),
    cell(fmtMoney(totalS), { bold: true, alignment: 'right', fontSize: 9 }, '#E8E2D9'),
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
  return [{ stack: [pdfSection('SOURCES & USES'), suTable], unbreakable: true }];
}

function pdfCapitalization(data: MemoData): any[] {
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
  const hdr = ['Instrument', 'Category', 'Amount', '% of Cap', ...(hasEbitda ? ['× EBITDA'] : [])].map(t => hdrCell(t));

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
      cell(fmtMoney(amt), { alignment: 'right' }, bg),
      cell(pctCap, { alignment: 'right', color: MUTED }, bg),
    ];
    if (hasEbitda) row.push(cell(xE, { alignment: 'right', color: DEBT_CATS.includes(r.category) ? NAVY : MUTED }, bg));
    return row;
  });

  function summaryRow(label: string, isBold: boolean, amount: number, pctStr: string, xEStr: string): any[] {
    const bg = '#FAFAF9';
    const row = [
      cell(label, { bold: isBold, color: isBold ? NAVY : MUTED, colSpan: 2 }, bg), {},
      cell(fmtMoney(amount), { bold: isBold, alignment: 'right', color: isBold ? NAVY : undefined }, bg),
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
    summaryRow('Total Debt',           false, totalDebt,   debtPct, debtXE),
    summaryRow('Total Equity',         false, totalEquity, eqPct,   '—'),
    summaryRow('Total Capitalization', true,  totalCap,    '100%',  debtXE),
  ];

  const capTable = { table: { widths: colW, headerRows: 1, body: [hdr, ...allRows] }, layout: thinLayout, margin: [0, 0, 0, 12] };

  const creditMetrics: Array<{ label: string; value: string }> = [
    { label: 'Senior Debt / EBITDA (pro-forma)',    value: hasEbitda && seniorDebt > 0 ? `${(seniorDebt / ebitdaVal).toFixed(2)}x` : 'n/m' },
    { label: 'Total Debt / EBITDA (pro-forma)',     value: hasEbitda ? `${(totalDebt / ebitdaVal).toFixed(2)}x` : 'n/m' },
    { label: 'Net Debt / EBITDA (pro-forma)',       value: hasEbitda ? `${(netDebt   / ebitdaVal).toFixed(2)}x` : 'n/m' },
    ...(rl != null ? [{ label: 'Authorized Revolver Limit', value: fmtMoney(rl) }] : []),
    { label: `Available Liquidity${rl == null ? ' (cash only — no revolver data)' : ''}`, value: fmtMoney(availLiq) },
    evProv != null
      ? { label: 'EV (provided)',                       value: fmtMoney(evProv) }
      : totalEquity > 0
        ? { label: 'EV (proxy: total cap net of cash)', value: fmtMoney(evProxy) }
        : { label: 'EV (proxy)',                        value: 'n/m (add equity)' },
    { label: 'Debt / Total Capitalization (pro-forma)', value: totalCap > 0 ? `${(totalDebt / totalCap * 100).toFixed(1)}%` : '—' },
  ];

  const metricsBody = creditMetrics.map((m, i) => [
    cell(m.label, { color: MUTED }, i % 2 === 1 ? '#F8F6F3' : undefined),
    cell(m.value, { alignment: 'right', bold: true, color: NAVY }, i % 2 === 1 ? '#F8F6F3' : undefined),
  ]);
  const metricsTable = { table: { widths: ['*', 100], body: metricsBody }, layout: thinLayout, margin: [0, 0, 0, 6] };

  const blockItems: any[] = [
    pdfSection('CAPITALIZATION'),
    { text: "Pro-forma transaction structure — reflects the proposed deal, not the borrower's historical balance sheet.", fontSize: 8.5, color: MUTED, italics: true, margin: [0, 0, 0, 10] },
    capTable,
    metricsTable,
  ];
  if (hasEbitda) {
    blockItems.push({ text: `EBITDA ${fmtMoney(ebitdaVal)}${cashVal > 0 ? `  ·  Cash ${fmtMoney(cashVal)}` : ''}`, fontSize: 8, color: MUTED, italics: true, margin: [0, 4, 0, 0] });
  }

  // The whole cap section — heading, pro-forma note, cap table, credit metrics — stays together.
  return [{ stack: blockItems, unbreakable: true }];
}

function pdfCollateral(data: MemoData): any[] {
  const items = data.collateral ?? [];
  if (!items.length) return [];

  const hdr  = ['Asset Type', 'Description', 'Market Value', 'Advance Rate', 'Lending Value'].map(t => hdrCell(t));
  const rows = items.map((it, i) => {
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(it.asset_type, {}, bg),
      cell(it.description, {}, bg),
      cell(fmtMoney(Number(it.market_value)),  { alignment: 'right' }, bg),
      cell(`${Math.round((it.advance_rate ?? 0) * 100)}%`, { alignment: 'right' }, bg),
      cell(fmtMoney(Number(it.lending_value)), { alignment: 'right' }, bg),
    ];
  });
  const totalL = items.reduce((s, it) => s + Number(it.lending_value), 0);
  rows.push([
    cell('Total Lending Value', { bold: true, colSpan: 4 }, '#E8E2D9'), {}, {}, {},
    cell(fmtMoney(totalL), { bold: true, alignment: 'right' }, '#E8E2D9'),
  ]);

  const collTable = { table: { widths: [80, '*', 82, 72, 82], headerRows: 1, body: [hdr, ...rows] }, layout: thinLayout, margin: [0, 0, 0, 6] };
  return [{ stack: [pdfSection('COLLATERAL'), collTable], unbreakable: true }];
}

function pdfDiligence(questions: MemoQuestion[]): any[] {
  if (!questions.length) return [];

  // The section heading gets its own page break; it's not wrapped in unbreakable
  // with questions because the first question may be long.
  const out: any[] = [pdfSection('ANNEX A — DILIGENCE QUESTIONS', true)];

  questions.forEach((q, i) => {
    const tag = [q.priority?.toUpperCase(), q.source].filter(Boolean).join(' · ');

    // Each question + its answer stay together as one unbreakable block.
    const qItems: any[] = [
      {
        columns: [
          { text: `Q${i + 1}.`, bold: true, fontSize: 9, color: NAVY, width: 28, margin: [0, 1, 0, 0] },
          {
            stack: [
              { text: [{ text: q.question_text, bold: true, fontSize: 9 }, tag ? { text: `  [${tag}]`, fontSize: 7.5, color: MUTED } : ''] },
              ...(q.related_metric ? [{ text: `Related: ${q.related_metric}`, fontSize: 7.5, color: MUTED, italics: true, margin: [0, 2, 0, 0] }] : []),
              ...(q.answer?.trim() ? [
                { text: 'Response:', fontSize: 8, bold: true, color: NAVY, margin: [0, 5, 0, 2] },
                { text: q.answer.trim(), fontSize: 8.5, lineHeight: 1.4 },
                ...(q.answer_assessment?.trim() ? [{ text: `Assessment: ${q.answer_assessment.trim()}`, fontSize: 8, color: MUTED, italics: true, margin: [0, 3, 0, 0] }] : []),
              ] : [
                { text: `Status: ${q.status ?? 'pending'}`, fontSize: 8, color: MUTED, italics: true, margin: [0, 2, 0, 0] },
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

function pdfMethodology(): any[] {
  return [
    pdfSection('METHODOLOGY NOTE'),
    pdfSubHead('Scoring Framework'),
    { text: 'The credit score is computed by a deterministic, rule-based engine applied to confirmed financial statement data. Each metric is evaluated against a three-band threshold (Strong / Adequate / Weak) and weighted by tier. No large language model participates in computing the numeric score.', fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead('Metric Tiers'),
    { text: 'Critical metrics (T1) carry the highest weight and can trigger a floor cap: if two or more grade Weak, or one grades Weak with high severity, the score is capped at 49. Significant (T2) and Supplementary (T3) metrics carry progressively lower weights.', fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead('Data Sources'),
    { text: 'Financial figures are sourced from lender-confirmed extracted statements. Metrics that cannot be computed (missing inputs, negative denominators) are excluded from scoring; the coverage percentage reflects the share that could be computed.', fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead('Historical Benchmark'),
    { text: 'Default rate and LGD data derive from SBA 7(a) loan-level records matched by NAICS sector and, where sample depth permits, by loan size and term band. Stress scenario reflects the 2008–2010 downturn cohort.', fontSize: 9, lineHeight: 1.5, margin: [0, 0, 0, 8] },
    pdfSubHead('Disclaimer'),
    { text: 'This memorandum is a draft analytical output prepared for internal underwriting review. It does not constitute a credit approval, commitment to lend, or investment advice. All figures are subject to verification.', fontSize: 9, lineHeight: 1.5, color: MUTED, italics: true },
  ];
}

function buildPdfDef(data: MemoData, questions: MemoQuestion[]): any {
  const borrower = data.deal.title ?? 'Credit Memorandum';
  const content: any[] = [
    ...pdfCover(data),
    ...pdfExecSummary(data),
    ...pdfMetrics(data),
    ...pdfAnalystCommentary(data),
    ...pdfStrengthsRisks(data),
    ...pdfBenchmark(data),
    ...pdfSourcesUses(data),
    ...pdfCapitalization(data),
    ...pdfCollateral(data),
    ...pdfDiligence(questions),
    ...pdfMethodology(),
  ];

  return {
    pageSize: 'LETTER',
    pageMargins: [40, 54, 40, 54],
    header: (currentPage: number) => {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: borrower, fontSize: 7.5, color: MUTED, margin: [40, 14, 0, 0] },
          { text: 'CONFIDENTIAL', fontSize: 7, color: MUTED, alignment: 'right', margin: [0, 14, 40, 0] },
        ],
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) {
        return { text: 'CONFIDENTIAL — DRAFT CREDIT MEMORANDUM', fontSize: 8, bold: true, color: MUTED, alignment: 'center', margin: [40, 0, 40, 14] };
      }
      return {
        columns: [
          { text: isoDate(), fontSize: 7, color: MUTED, margin: [40, 0, 0, 14] },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', fontSize: 7, color: MUTED, margin: [0, 0, 40, 14] },
        ],
      };
    },
    content,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#222222' },
  };
}

export async function downloadPDF(data: MemoData, questions: MemoQuestion[]): Promise<void> {
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

  const docDef = buildPdfDef(data, questions);
  await pdfMake.createPdf(docDef).download(memoFilename(data.deal.title, 'pdf'));
}

// ══════════════════════════════════════════════════════════════════════════════
// Word export (docx 9)
// ══════════════════════════════════════════════════════════════════════════════

export async function downloadDocx(data: MemoData, questions: MemoQuestion[]): Promise<void> {
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

  const children: any[] = [];

  // ── Cover ──
  children.push(
    new Paragraph({ children: [new TextRun({ text: data.deal.title ?? 'Credit Memorandum', bold: true, size: 52, color: NAVY.replace('#', ''), font: 'Fraunces' })], spacing: { before: 1440, after: 240 } }),
    ...(data.deal.industry ? [new Paragraph({ children: [new TextRun({ text: `Industry: ${data.deal.industry}`, size: 24, color: '888888', font: 'Calibri' })], spacing: { after: 120 } })] : []),
    ...([data.deal.city, data.deal.province].filter(Boolean).length > 0 ? [new Paragraph({ children: [new TextRun({ text: [data.deal.city, data.deal.province].filter(Boolean).join(', '), size: 22, color: '888888', font: 'Calibri' })], spacing: { after: 120 } })] : []),
  );
  if (data.score?.overall_score != null) {
    children.push(
      wSpacer(240),
      new Paragraph({ children: [new TextRun({ text: 'Credit Score', size: 20, color: '888888', font: 'Calibri' })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: `${data.score.overall_score}${data.score.risk_label ? '  —  ' + data.score.risk_label : ''}`, bold: true, size: 56, color: NAVY.replace('#', ''), font: 'Fraunces' })], spacing: { after: 240 } }),
    );
  }
  children.push(
    new Paragraph({ children: [new TextRun({ text: isoDate(), size: 36, color: '888888', font: 'Calibri' })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: 'CONFIDENTIAL — DRAFT CREDIT MEMORANDUM', bold: true, size: 18, color: '888888', font: 'Calibri' })], spacing: { after: 0 } }),
    wPageBreak(),
  );

  // ── Executive Summary ──
  const execText = data.deal.executive_summary?.trim();
  if (execText) {
    children.push(wHead1('Executive Summary'));
    splitIntoParagraphs(execText).forEach(p => children.push(wPara(p, { spaceAfter: 160 })));
    children.push(wPageBreak());
  }

  // ── Financial Metrics ──
  children.push(wHead1('Financial Metrics'));
  if (data.score?.coverage_pct != null) children.push(wPara(`Metric coverage: ${data.score.coverage_pct}% of the scoring framework was computable from the financial statements provided.`, { italics: true, color: '888888', spaceAfter: 160 }));

  const scored    = data.metrics.filter(m => m.counted);
  const notScored = data.metrics.filter(m => !m.counted);

  if (scored.length > 0) {
    children.push(wHead2('Scored Metrics'));
    const mCols = [2800, 620, 620, 620, 1000, 1000, 1000];
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow(['Metric', 'Tier', 'Value', 'Grade', 'Strong', 'Adequate', 'Weak'], mCols),
        ...scored.map((r, i) => wDataRow([r.metric_name, r.tier, fmtVal(r.value, r.metric_name), r.grade, r.strong_band ?? '—', r.adequate_band ?? '—', r.weak_band ?? '—'], mCols, i % 2 === 1)),
      ],
    }), wSpacer(200));
  }

  if (notScored.length > 0) {
    children.push(wHead2('Not Scored'));
    const nsCols = [3800, 800, 3060];
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow(['Metric', 'Tier', 'Reason'], nsCols),
        ...notScored.map((r, i) => wDataRow([r.metric_name, r.tier, statusLabel(r.status)], nsCols, i % 2 === 1)),
      ],
    }), wSpacer(200));
  }

  // ── Analyst Commentary ──
  const summaryText = data.score?.summary?.trim();
  if (summaryText) {
    children.push(wHead1('Analyst Commentary'));
    splitIntoParagraphs(summaryText).forEach(p => children.push(wPara(p, { spaceAfter: 160 })));
  }

  // ── Strengths & Risks ──
  const strengths = data.score?.strengths ?? [];
  const risks     = data.score?.risks ?? [];
  if (strengths.length || risks.length) {
    children.push(wHead1('Strengths & Risks'));
    if (strengths.length) {
      children.push(wHead2('Key Strengths'));
      // keepNext on all bullets except the last keeps the list from splitting mid-way
      strengths.forEach((s, i) => children.push(wBullet(s, STRONG.replace('#', ''), i < strengths.length - 1)));
    }
    if (risks.length) {
      // wHead2 has keepNext: true, binding it to the first bullet
      children.push(wHead2('Key Risks'));
      risks.forEach((r, i) => children.push(wBullet(r, RED.replace('#', ''), i < risks.length - 1)));
    }
    children.push(wSpacer(160));
  }

  // ── Historical Benchmark ──
  const bm = data.benchmarks;
  if (bm && !bm.noMapping && bm.base?.sector && bm.stress?.sector) {
    const { base, stress, totalN } = bm;
    const industryLabel = (data.deal.industry ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Sector';
    const baseLGD   = Math.round(base!.sector!.lgd  * 100);
    const stressLGD = Math.round(stress!.sector!.lgd * 100);
    const dealSB = sbaBand(data.deal.amount_requested ?? 0);
    const dealTB = sbaTermBand(data.deal.term_months ?? 0);
    const hasSegment = base?.segment && stress?.segment;

    children.push(wHead1('Historical Benchmark — SBA 7(a) Loan Data'));

    const bmCols = [2200, 1700, 1700];
    const bmHdrRow = new TableRow({
      tableHeader: true, cantSplit: true,
      children: [
        new TableCell({ width: { size: bmCols[0], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: 'Segment', bold: true, size: 18, color: NAVY.replace('#', '') })], spacing: { after: 0 } })] }),
        new TableCell({ width: { size: bmCols[1], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: 'Loans that defaulted — Normal cycle · FY2010–2016', size: 17, color: NAVY.replace('#', '') })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })] }),
        new TableCell({ width: { size: bmCols[2], type: WidthType.DXA }, shading: shade('#F0EDE8'), borders: { top: noBorder, bottom: thickBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: 'Loans that defaulted — 2008 downturn · FY2004–2008', size: 17, color: RED.replace('#', '') })], spacing: { after: 0 }, alignment: AlignmentType.CENTER })] }),
      ],
    });

    function bmDataRowW(segLabel: string, baseDR: number, baseN: number, stressDR: number, stressN: number, shaded = false): any {
      const fill = shaded ? 'F8F6F3' : 'FFFFFF';
      return new TableRow({ cantSplit: true, children: [
        new TableCell({ width: { size: bmCols[0], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: segLabel, bold: !shaded, size: 18, font: 'Calibri' })], spacing: { after: 0 } })] }),
        new TableCell({ width: { size: bmCols[1], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: `${pct(baseDR)} of ${baseN.toLocaleString('en-US')} loans`, size: 18, font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
        new TableCell({ width: { size: bmCols[2], type: WidthType.DXA }, shading: shade(fill), borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
          children: [new Paragraph({ children: [new TextRun({ text: `${pct(stressDR)} of ${stressN.toLocaleString('en-US')} loans`, size: 18, color: RED.replace('#', ''), font: 'Calibri' })], alignment: AlignmentType.CENTER, spacing: { after: 0 } })] }),
      ]});
    }

    children.push(new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: [
      bmHdrRow,
      bmDataRowW(`${industryLabel} sector`, base!.sector!.default_rate, base!.sector!.n_loans, stress!.sector!.default_rate, stress!.sector!.n_loans),
      ...(hasSegment ? [bmDataRowW(`${dealSB} · ${dealTB}`, base!.segment!.default_rate, base!.segment!.n_loans, stress!.segment!.default_rate, stress!.segment!.n_loans, true)] : []),
    ]}), wSpacer(160));

    if (hasSegment && base?.sector?.default_rate) {
      const ratio = base!.segment!.default_rate / base!.sector!.default_rate;
      if (ratio >= 1.3 || ratio <= 0.75) {
        const msg = ratio >= 1.3
          ? 'Loans of this size and term defaulted notably more often than the sector as a whole. In SBA lending, shorter terms are typically associated with working-capital facilities and younger or thinner-margin businesses.'
          : 'Loans of this size and term defaulted less often than the sector as a whole. Longer amortisation and larger facilities generally indicate established borrowers with harder collateral, which historically supported better repayment performance.';
        children.push(wPara(msg, { italics: true, spaceAfter: 120, keepNext: true }));
      }
    }

    children.push(
      wPara('Loss Given Default', { bold: true, spaceAfter: 60, keepNext: true }),
      wPara(`When these loans did fail, lenders lost about ~${baseLGD} cents on every dollar owed in a normal cycle — and about ~${stressLGD} cents in the 2008 downturn, because collateral was worth less at the same time defaults rose.`, { spaceAfter: 120, keepNext: true }),
      wPara(`This benchmark comes from ${(totalN ?? 0).toLocaleString('en-US')} comparable loans within a dataset of 698,000 U.S. SBA 7(a) loans that have fully run their course. The normal-cycle figures cover loans approved between 2010 and 2016; the downturn figures cover loans approved between 2004 and 2008. This is U.S. small-business lending data shown for context — it is not a prediction about this borrower.`, { italics: true, color: '888888', spaceAfter: 200 }),
    );
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
    const suRows: any[] = [wHdrRow(['Use of Funds', 'Amount', 'Source of Funds', 'Amount'], suCols)];
    for (let i = 0; i < maxLen; i++) {
      suRows.push(wDataRow([uses[i]?.label ?? '', uses[i] ? fmtMoney(Number(uses[i].amount)) : '', srcs[i]?.label ?? '', srcs[i] ? fmtMoney(Number(srcs[i].amount)) : ''], suCols, i % 2 === 1));
    }
    suRows.push(wTotalRow(['Total Uses', fmtMoney(totalU), 'Total Sources', fmtMoney(totalS)], suCols));
    children.push(wHead1('Sources & Uses'), new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: suRows }), wSpacer(200));
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
    const capHdrLabels = ['Instrument', 'Category', 'Amount', '% of Cap', ...(hasEbitda ? ['× EBITDA'] : [])];

    let cumDebt2 = 0;
    const capRows: any[] = [wHdrRow(capHdrLabels, capColsW)];
    sorted.forEach((r, i) => {
      const amt    = Number(r.amount);
      const pctCap = totalCap > 0 ? `${(amt / totalCap * 100).toFixed(1)}%` : '—';
      let xE = '—';
      if (hasEbitda && DEBT_CATS.includes(r.category)) { cumDebt2 += amt; xE = `${(cumDebt2 / ebitdaVal).toFixed(2)}x`; }
      capRows.push(wDataRow([r.label, r.category, fmtMoney(amt), pctCap, ...(hasEbitda ? [xE] : [])], capColsW, i % 2 === 1));
    });
    const debtRow  = ['Total Debt',  '', fmtMoney(totalDebt),  totalCap > 0 ? `${(totalDebt /totalCap*100).toFixed(1)}%` : '—', ...(hasEbitda ? [totalDebt  > 0 ? `${(totalDebt /ebitdaVal).toFixed(2)}x` : '—'] : [])];
    const eqRow    = ['Total Equity','', fmtMoney(totalEquity),totalCap > 0 ? `${(totalEquity/totalCap*100).toFixed(1)}%` : '—', ...(hasEbitda ? ['—'] : [])];
    const totalRow = ['Total Capitalization','', fmtMoney(totalCap),'100%',           ...(hasEbitda ? [totalDebt  > 0 ? `${(totalDebt /ebitdaVal).toFixed(2)}x` : '—'] : [])];
    capRows.push(wTotalRow(debtRow,  capColsW, 'FAFAF9'));
    capRows.push(wTotalRow(eqRow,    capColsW, 'FAFAF9'));
    capRows.push(wTotalRow(totalRow, capColsW, 'E8E2D9'));

    const creditMetrics: Array<{ label: string; value: string }> = [
      { label: 'Senior Debt / EBITDA (pro-forma)',  value: hasEbitda && seniorDebt > 0 ? `${(seniorDebt/ebitdaVal).toFixed(2)}x` : 'n/m' },
      { label: 'Total Debt / EBITDA (pro-forma)',   value: hasEbitda ? `${(totalDebt/ebitdaVal).toFixed(2)}x` : 'n/m' },
      { label: 'Net Debt / EBITDA (pro-forma)',     value: hasEbitda ? `${(netDebt/ebitdaVal).toFixed(2)}x` : 'n/m' },
      ...(rl != null ? [{ label: 'Authorized Revolver Limit', value: fmtMoney(rl) }] : []),
      { label: `Available Liquidity${rl == null ? ' (cash only)' : ''}`, value: fmtMoney(availLiq) },
      evProv != null ? { label: 'EV (provided)', value: fmtMoney(evProv) }
        : totalEquity > 0 ? { label: 'EV (proxy: total cap net of cash)', value: fmtMoney(evProxy) }
        : { label: 'EV (proxy)', value: 'n/m' },
      { label: 'Debt / Total Capitalization (pro-forma)', value: totalCap > 0 ? `${(totalDebt/totalCap*100).toFixed(1)}%` : '—' },
    ];
    const mCols2 = [6200, 2460];
    const mRows  = creditMetrics.map((m, i) => wDataRow([m.label, m.value], mCols2, i % 2 === 1));

    children.push(
      wHead1('Capitalization'),
      wPara("Pro-forma transaction structure — reflects the proposed deal, not the borrower's historical balance sheet.", { italics: true, color: '888888', spaceAfter: 120, keepNext: true }),
      new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: capRows }),
      wSpacer(160),
      wHead2('Credit Metrics'),
      new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: mRows }),
      ...(hasEbitda ? [wSpacer(80), wPara(`EBITDA ${fmtMoney(ebitdaVal)}${cashVal > 0 ? `  ·  Cash ${fmtMoney(cashVal)}` : ''}`, { italics: true, color: '888888', spaceAfter: 0 })] : []),
      wSpacer(200),
    );
  }

  // ── Collateral ──
  const collateral = data.collateral ?? [];
  if (collateral.length) {
    const collCols = [1300, 2100, 1440, 1200, 1620];
    const totalL   = collateral.reduce((s, it) => s + Number(it.lending_value), 0);
    children.push(wHead1('Collateral'), new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: [
      wHdrRow(['Asset Type', 'Description', 'Market Value', 'Advance Rate', 'Lending Value'], collCols),
      ...collateral.map((it, i) => wDataRow([it.asset_type, it.description ?? '—', fmtMoney(Number(it.market_value)), `${Math.round((it.advance_rate ?? 0)*100)}%`, fmtMoney(Number(it.lending_value))], collCols, i % 2 === 1)),
      wTotalRow(['Total Lending Value', '', '', '', fmtMoney(totalL)], collCols),
    ]}), wSpacer(200));
  }

  // ── Diligence Questions ──
  if (questions.length) {
    children.push(wPageBreak(), wHead1('Annex A — Diligence Questions'));
    questions.forEach((q, i) => {
      const tag = [q.priority?.toUpperCase(), q.source].filter(Boolean).join(' · ');
      // keepNext chains the question lines together so they don't split across pages.
      children.push(wPara(`Q${i + 1}. ${q.question_text}${tag ? `  [${tag}]` : ''}`, { bold: true, spaceAfter: 60, keepNext: true }));
      if (q.related_metric) children.push(wPara(`Related: ${q.related_metric}`, { italics: true, color: '888888', spaceAfter: 60, keepNext: true }));
      if (q.answer?.trim()) {
        children.push(
          wPara('Response:', { bold: true, spaceAfter: 40, keepNext: true }),
          wPara(q.answer.trim(), { spaceAfter: 60, keepNext: !!q.answer_assessment?.trim() }),
        );
        if (q.answer_assessment?.trim()) children.push(wPara(`Assessment: ${q.answer_assessment.trim()}`, { italics: true, color: '888888', spaceAfter: 60 }));
      } else {
        children.push(wPara(`Status: ${q.status ?? 'pending'}`, { italics: true, color: '888888', spaceAfter: 60 }));
      }
      if (i < questions.length - 1) children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D8D2C8' } }, spacing: { after: 120 } }));
    });
    children.push(wSpacer(240));
  }

  // ── Methodology ──
  children.push(wPageBreak(), wHead1('Methodology Note'));
  children.push(
    wHead2('Scoring Framework'),
    wPara('The credit score is computed by a deterministic, rule-based engine applied to confirmed financial statement data. Each metric is evaluated against a three-band threshold (Strong / Adequate / Weak) and weighted by tier. No large language model participates in computing the numeric score.', { spaceAfter: 160 }),
    wHead2('Metric Tiers'),
    wPara('Critical metrics (T1) carry the highest weight and can trigger a floor cap: if two or more grade Weak, or one grades Weak with high severity, the score is capped at 49. Significant (T2) and Supplementary (T3) metrics carry progressively lower weights.', { spaceAfter: 160 }),
    wHead2('Disclaimer'),
    wPara('This memorandum is a draft analytical output prepared for internal underwriting review. It does not constitute a credit approval, commitment to lend, or investment advice. All figures are subject to verification.', { italics: true, color: '888888', spaceAfter: 0 }),
  );

  const borrower = data.deal.title ?? 'Credit Memorandum';
  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: TWIP_PG, height: 15840 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      headers: {
        default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: `${borrower}     CONFIDENTIAL`, size: 16, color: '888888', font: 'Calibri' })], spacing: { after: 0 } })] }),
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
  a.href = url; a.download = memoFilename(data.deal.title, 'docx');
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
