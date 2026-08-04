// Credit memo export — PDF (pdfmake 0.3) and Word (docx 9)

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

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function fmtVal(v: number | null | undefined, name: string): string {
  if (v == null) return '—';
  if (/dscr|ratio|coverage|multiple|leverage|ltv|ltr/i.test(name)) return `${v.toFixed(2)}x`;
  if (/margin|return|growth|yield/i.test(name)) return `${(v * 100).toFixed(1)}%`;
  return v.toFixed(2);
}

function gradeColor(grade: string): string {
  const g = grade?.toLowerCase() ?? '';
  if (g === 'strong')   return STRONG;
  if (g === 'adequate') return AMBER;
  if (g === 'weak')     return RED;
  return '#555555';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    needs_input:              'Data not available',
    needs_review:             'Degenerate (negative base)',
    qualitative:              'Qualitative — external judgment',
    needs_document_or_input:  'Awaiting documentation',
    excluded:                 'Excluded',
  };
  return map[status?.toLowerCase() ?? ''] ?? (status ?? '—');
}

function pct(r: number | null | undefined): string {
  if (r == null) return '—';
  return `${(r * 100).toFixed(1)}%`;
}

function isoDate(): string {
  return new Date().toLocaleDateString('en-CA');
}

function memoFilename(title: string | null | undefined, ext: string): string {
  const base = (title ?? 'Credit_Memo')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Credit_Memo';
  return `${base}_Credit_Memo_${isoDate()}.${ext}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF export (pdfmake 0.3)
// ══════════════════════════════════════════════════════════════════════════════

// pdfmake cell helpers
function cell(
  text: string | null | undefined,
  opts: Record<string, any> = {},
  fill?: string,
): any {
  return { text: text ?? '—', fontSize: 8.5, margin: [4, 3, 4, 3], fillColor: fill ?? null, ...opts };
}

function hdrCell(text: string): any {
  return { text, bold: true, fontSize: 8.5, color: '#ffffff', fillColor: NAVY, margin: [4, 5, 4, 5] };
}

const thinLayout = {
  hLineWidth: (i: number, node: any) =>
    i === 0 || i === node.table.body.length ? 0 : 0.3,
  vLineWidth: () => 0,
  hLineColor: () => '#D8D2C8',
  paddingLeft:   () => 0,
  paddingRight:  () => 0,
  paddingTop:    () => 0,
  paddingBottom: () => 0,
};

function pdfSection(text: string, first = false): any {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, bold: true, fontSize: 10.5, color: '#ffffff', fillColor: NAVY, margin: [10, 6, 10, 6] }]],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 10],
    ...(first ? {} : { pageBreak: 'before' }),
  };
}

function pdfSubHead(text: string): any {
  return { text, bold: true, fontSize: 9.5, color: NAVY, margin: [0, 8, 0, 4] };
}

function pdfHR(): any {
  return {
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 0.4, lineColor: '#D8D2C8' }],
    margin: [0, 5, 0, 5],
  };
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

function pdfMetricsTable(rows: MemoMetric[]): any {
  const header = ['Metric', 'Tier', 'Value', 'Grade', 'Strong', 'Adequate', 'Weak'].map(hdrCell);
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
    table: { widths: ['*', 55, 52, 50, 68, 68, 68], headerRows: 1, body: [header, ...body] },
    layout: thinLayout,
    margin: [0, 0, 0, 6],
  };
}

// ── PDF section builders ──────────────────────────────────────────────────────

function pdfCover(data: MemoData): any[] {
  const loc    = [data.deal.city, data.deal.province].filter(Boolean).join(', ');
  const loanParts = [
    data.deal.amount_requested ? fmtMoney(data.deal.amount_requested) + ' requested' : null,
    data.deal.term_months ? `${data.deal.term_months}-month term` : null,
    data.deal.interest_rate ? `${data.deal.interest_rate}% p.a.` : null,
  ].filter(Boolean);

  return [
    { text: ' ', fontSize: 52, margin: [0, 48, 0, 0] },
    { text: data.deal.title ?? 'Credit Memorandum', fontSize: 26, bold: true, color: NAVY, margin: [0, 0, 0, 6] },
    { text: [data.deal.industry, loc].filter(Boolean).join(' · ') || ' ', fontSize: 11, color: MUTED, margin: [0, 0, 0, 20] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 520, y2: 0, lineWidth: 2, lineColor: GOLD }], margin: [0, 0, 0, 20] },
    ...(loanParts.length ? [{ text: loanParts.join(' · '), fontSize: 11, color: NAVY, margin: [0, 0, 0, 0] }] : []),
    ...(data.deal.years_in_business ? [{ text: `${data.deal.years_in_business} years in operation`, fontSize: 10, color: MUTED, margin: [0, 4, 0, 0] }] : []),
    ...(data.score?.overall_score != null ? [
      { text: ' ', margin: [0, 20, 0, 0] },
      {
        columns: [
          { text: 'Credit Score', fontSize: 9, color: MUTED, margin: [0, 10, 0, 0] },
          { text: String(data.score.overall_score), fontSize: 34, bold: true, color: NAVY, alignment: 'right' },
        ],
      },
      {
        columns: [
          { text: '', width: '*' },
          { text: data.score.risk_label ?? '', fontSize: 11, color: GOLD, alignment: 'right' },
        ],
        margin: [0, 0, 0, 40],
      },
    ] : [{ margin: [0, 60, 0, 0], text: '' }]),
    { text: isoDate(), fontSize: 9, color: MUTED, margin: [0, 0, 0, 4] },
    { text: 'CONFIDENTIAL — DRAFT CREDIT MEMORANDUM', fontSize: 8, bold: true, color: MUTED },
    { text: ' ', fontSize: 1, pageBreak: 'after', margin: [0, 0, 0, 0] },
  ];
}

function pdfExecSummary(data: MemoData): any[] {
  const text = data.deal.executive_summary?.trim();
  if (!text) return [];
  const paras = (text.includes('\n\n') ? text.split('\n\n') : text.split('\n')).filter(p => p.trim());
  return [
    pdfSection('EXECUTIVE SUMMARY'),
    ...paras.map((p, i) => ({
      text: p.trim(),
      fontSize: 9,
      lineHeight: 1.55,
      margin: [0, 0, 0, i < paras.length - 1 ? 8 : 0],
    })),
  ];
}

function pdfMetrics(data: MemoData): any[] {
  const scored    = data.metrics.filter(m => m.counted);
  const notScored = data.metrics.filter(m => !m.counted);
  const out: any[] = [pdfSection('FINANCIAL METRICS')];

  if (data.score?.coverage_pct != null) {
    out.push({
      text: `Metric coverage: ${data.score.coverage_pct}% of the scoring framework was computable from the financial statements provided.`,
      fontSize: 8.5, color: MUTED, italics: true, margin: [0, 0, 0, 10],
    });
  }
  if (data.score?.critical_floor_applied) {
    out.push({
      text: `Note: The critical-metric floor was applied — the overall score is capped at 49. ${data.score.capped_reason ?? ''}`.trim(),
      fontSize: 8.5, color: RED, italics: true, margin: [0, 0, 0, 10],
    });
  }

  if (scored.length > 0) {
    out.push(pdfSubHead('Scored Metrics'));
    out.push(pdfMetricsTable(scored));
  }

  if (notScored.length > 0) {
    out.push(pdfSubHead('Not Scored'));
    const nsHdr = ['Metric', 'Tier', 'Reason'].map(hdrCell);
    const nsRows = notScored.map((r, i) => {
      const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
      return [cell(r.metric_name, {}, bg), cell(r.tier, { fontSize: 7.5, color: MUTED }, bg), cell(statusLabel(r.status), { fontSize: 8, color: MUTED }, bg)];
    });
    out.push({
      table: { widths: ['*', 70, '*'], headerRows: 1, body: [nsHdr, ...nsRows] },
      layout: thinLayout,
      margin: [0, 0, 0, 6],
    });
  }

  return out;
}

function pdfAnalystCommentary(data: MemoData): any[] {
  const text = data.score?.summary?.trim();
  if (!text) return [];
  const paras = text.split('\n').filter(p => p.trim());
  return [
    pdfSection('ANALYST COMMENTARY'),
    ...paras.map((p, i) => ({ text: p.trim(), fontSize: 9, lineHeight: 1.55, margin: [0, 0, 0, i < paras.length - 1 ? 8 : 0] })),
  ];
}

function pdfStrengthsRisks(data: MemoData): any[] {
  const s = data.score?.strengths ?? [];
  const r = data.score?.risks ?? [];
  if (!s.length && !r.length) return [];
  const out: any[] = [pdfSection('STRENGTHS & RISKS')];
  if (s.length) { out.push(pdfSubHead('Key Strengths')); out.push(...pdfBullets(s, STRONG)); }
  if (r.length) { out.push(pdfSubHead('Key Risks'));     out.push(...pdfBullets(r, RED));    }
  return out;
}

function pdfBenchmark(data: MemoData): any[] {
  const bm = data.benchmarks;
  if (!bm || bm.noMapping || (!bm.base?.sector && !bm.base?.segment)) return [];
  const { base, stress } = bm;
  const hasSector  = base?.sector  && stress?.sector;
  const hasSegment = base?.segment && stress?.segment;
  if (!hasSector && !hasSegment) return [];

  const out: any[] = [pdfSection('HISTORICAL BENCHMARK — SBA 7(a) Loan Data')];
  const hdr = ['Cohort', 'N Loans', 'Default Rate (Normal)', 'Default Rate (Stress)', 'LGD (Normal)', 'LGD (Stress)'].map(hdrCell);
  const rows: any[][] = [];

  if (hasSector) {
    rows.push([
      cell(`Sector — NAICS ${base!.sector.naics2}`),
      cell((base!.sector.n_loans ?? '—').toLocaleString()),
      cell(pct(base!.sector.default_rate)),
      cell(pct(stress?.sector?.default_rate)),
      cell(pct(base!.sector.lgd)),
      cell(pct(stress?.sector?.lgd)),
    ]);
  }
  if (hasSegment) {
    const bg = '#F8F6F3';
    rows.push([
      cell(`Segment — ${base!.segment.size_band} / ${base!.segment.term_band}`, {}, bg),
      cell((base!.segment.n_loans ?? '—').toLocaleString(), {}, bg),
      cell(pct(base!.segment.default_rate), {}, bg),
      cell(pct(stress?.segment?.default_rate), {}, bg),
      cell(pct(base!.segment.lgd), {}, bg),
      cell(pct(stress?.segment?.lgd), {}, bg),
    ]);
  }

  out.push({
    table: { widths: ['*', 52, 90, 92, 72, 72], headerRows: 1, body: [hdr, ...rows] },
    layout: thinLayout,
    margin: [0, 0, 0, 8],
  });
  out.push({
    text: `Source: SBA 7(a) loan-level data. Base = normal cycle; Stress = 2008–2010 downturn. Total sample: ${bm.totalN?.toLocaleString() ?? '—'} loans.`,
    fontSize: 7.5, color: MUTED, italics: true,
  });
  return out;
}

function pdfSourcesUses(data: MemoData): any[] {
  const entries = data.suEntries ?? [];
  if (!entries.length) return [];

  const uses    = entries.filter(e => e.side === 'use');
  const sources = entries.filter(e => e.side === 'source');
  const totalU  = uses.reduce((s, e) => s + Number(e.amount), 0);
  const totalS  = sources.reduce((s, e) => s + Number(e.amount), 0);

  const hdr = [hdrCell('Use of Funds'), hdrCell('Amount'), hdrCell('Source of Funds'), hdrCell('Amount')];
  const maxLen = Math.max(uses.length, sources.length);
  const rows = Array.from({ length: maxLen }, (_, i) => {
    const u = uses[i]; const s = sources[i];
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(u?.label ?? '', {}, bg),
      cell(u ? fmtMoney(Number(u.amount)) : '', { alignment: 'right' }, bg),
      cell(s?.label ?? '', {}, bg),
      cell(s ? fmtMoney(Number(s.amount)) : '', { alignment: 'right' }, bg),
    ];
  });
  rows.push([
    cell('Total Uses', { bold: true }, '#E8E2D9'),
    cell(fmtMoney(totalU), { bold: true, alignment: 'right' }, '#E8E2D9'),
    cell('Total Sources', { bold: true }, '#E8E2D9'),
    cell(fmtMoney(totalS), { bold: true, alignment: 'right' }, '#E8E2D9'),
  ]);

  const suLayout = {
    ...thinLayout,
    vLineWidth: (i: number) => i === 2 ? 0.4 : 0,
    vLineColor: () => '#D8D2C8',
  };

  return [
    pdfSection('SOURCES & USES'),
    { table: { widths: ['*', 80, '*', 80], headerRows: 1, body: [hdr, ...rows] }, layout: suLayout, margin: [0, 0, 0, 6] },
  ];
}

function pdfCapitalization(data: MemoData): any[] {
  const items = data.capItems ?? [];
  if (!items.length) return [];

  const hdr  = ['Category', 'Description', 'Amount', 'Rate'].map(hdrCell);
  const rows = items.map((it, i) => {
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(it.category, {}, bg),
      cell(it.label, {}, bg),
      cell(fmtMoney(Number(it.amount)), { alignment: 'right' }, bg),
      cell(it.rate ? `${it.rate}%` : '—', { alignment: 'right' }, bg),
    ];
  });

  return [
    pdfSection('CAPITALIZATION'),
    { table: { widths: [100, '*', 90, 55], headerRows: 1, body: [hdr, ...rows] }, layout: thinLayout, margin: [0, 0, 0, 6] },
  ];
}

function pdfCollateral(data: MemoData): any[] {
  const items = data.collateral ?? [];
  if (!items.length) return [];

  const hdr  = ['Asset Type', 'Description', 'Market Value', 'Advance Rate', 'Lending Value'].map(hdrCell);
  const rows = items.map((it, i) => {
    const bg = i % 2 === 1 ? '#F8F6F3' : undefined;
    return [
      cell(it.asset_type, {}, bg),
      cell(it.description, {}, bg),
      cell(fmtMoney(Number(it.market_value)), { alignment: 'right' }, bg),
      cell(`${Math.round((it.advance_rate ?? 0) * 100)}%`, { alignment: 'right' }, bg),
      cell(fmtMoney(Number(it.lending_value)), { alignment: 'right' }, bg),
    ];
  });
  const totalLending = items.reduce((s, it) => s + Number(it.lending_value), 0);
  rows.push([
    cell('Total Lending Value', { bold: true, colSpan: 4 }, '#E8E2D9'), {}, {}, {},
    cell(fmtMoney(totalLending), { bold: true, alignment: 'right' }, '#E8E2D9'),
  ]);

  return [
    pdfSection('COLLATERAL'),
    { table: { widths: [80, '*', 82, 72, 82], headerRows: 1, body: [hdr, ...rows] }, layout: thinLayout, margin: [0, 0, 0, 6] },
  ];
}

function pdfDiligence(questions: MemoQuestion[]): any[] {
  if (!questions.length) return [];
  const out: any[] = [pdfSection('ANNEX A — DILIGENCE QUESTIONS')];
  questions.forEach((q, i) => {
    const tag = [q.priority ? q.priority.toUpperCase() : null, q.source ? q.source : null].filter(Boolean).join(' · ');
    out.push({
      columns: [
        { text: `Q${i + 1}.`, bold: true, fontSize: 9, color: NAVY, width: 28, margin: [0, 1, 0, 0] },
        {
          stack: [
            { text: [{ text: q.question_text, bold: true, fontSize: 9 }, tag ? { text: `  [${tag}]`, fontSize: 7.5, color: MUTED } : ''] },
            ...(q.related_metric ? [{ text: `Related metric: ${q.related_metric}`, fontSize: 7.5, color: MUTED, italics: true, margin: [0, 2, 0, 0] }] : []),
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
    });
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
      if (currentPage === 1) return null;
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
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  // browser build exports itself as named exports; fonts export the vfs object
  const pdfMake = (pdfMakeModule as any).default ?? pdfMakeModule;
  const vfs = (pdfFontsModule as any).default ?? pdfFontsModule;
  pdfMake.addVirtualFileSystem(vfs);

  const docDef = buildPdfDef(data, questions);
  const filename = memoFilename(data.deal.title, 'pdf');
  await pdfMake.createPdf(docDef).download(filename);
}

// ══════════════════════════════════════════════════════════════════════════════
// Word export (docx 9)
// ══════════════════════════════════════════════════════════════════════════════

export async function downloadDocx(data: MemoData, questions: MemoQuestion[]): Promise<void> {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, HeadingLevel, Header, Footer, PageBreak,
    ShadingType, BorderStyle, PageNumber,
  } = await import('docx');

  const TWIP_PG  = 12240; // 8.5" letter
  const MARGIN   = 1080;  // 0.75" margin
  const TW_CONT  = TWIP_PG - MARGIN * 2; // ~10080 twip for content

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const rowBorder = { style: BorderStyle.SINGLE, size: 4, color: 'D8D2C8' };

  function wPara(text: string, opts: Record<string, any> = {}): any {
    return new Paragraph({
      children: [new TextRun({ text, size: opts.size ?? 20, bold: opts.bold, color: opts.color, italics: opts.italics })],
      alignment: opts.align ?? AlignmentType.LEFT,
      spacing: { after: opts.spaceAfter ?? 120, before: opts.spaceBefore ?? 0 },
      ...opts.paragraphOpts,
    });
  }

  function wHead1(text: string): any {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 28, color: NAVY.replace('#', '') })],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160 },
    });
  }

  function wHead2(text: string): any {
    return new Paragraph({
      children: [new TextRun({ text, bold: true, size: 22, color: NAVY.replace('#', '') })],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 80 },
    });
  }

  function wBullet(text: string, color = '222222'): any {
    return new Paragraph({
      children: [new TextRun({ text: `• ${text}`, size: 20, color })],
      spacing: { after: 60 },
      indent: { left: 360 },
    });
  }

  function wPageBreak(): any {
    return new Paragraph({ children: [new PageBreak()] });
  }

  function wHdrRow(cells: string[], widths: number[]): any {
    return new TableRow({
      tableHeader: true,
      children: cells.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill: NAVY.replace('#', ''), type: ShadingType.CLEAR, color: NAVY.replace('#', '') },
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({
          children: [new TextRun({ text: c, bold: true, size: 18, color: 'FFFFFF' })],
          spacing: { after: 0, before: 0 },
        })],
      })),
    });
  }

  function wDataRow(cells: string[], widths: number[], shaded = false): any {
    const fill = shaded ? 'F8F6F3' : 'FFFFFF';
    return new TableRow({
      children: cells.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR, color: fill },
        borders: { top: rowBorder, bottom: rowBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({
          children: [new TextRun({ text: c, size: 18 })],
          spacing: { after: 0, before: 0 },
        })],
      })),
    });
  }

  function wTotalRow(cells: string[], widths: number[]): any {
    const fill = 'E8E2D9';
    return new TableRow({
      children: cells.map((c, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR, color: fill },
        borders: { top: rowBorder, bottom: noBorder, left: noBorder, right: noBorder },
        children: [new Paragraph({
          children: [new TextRun({ text: c, size: 18, bold: true })],
          spacing: { after: 0, before: 0 },
        })],
      })),
    });
  }

  // Sections
  const children: any[] = [];

  // Cover
  children.push(
    new Paragraph({
      children: [new TextRun({ text: data.deal.title ?? 'Credit Memorandum', bold: true, size: 52, color: NAVY.replace('#', '') })],
      spacing: { before: 1440, after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: [data.deal.industry, [data.deal.city, data.deal.province].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || ' ', size: 24, color: '888888' })],
      spacing: { after: 480 },
    }),
    new Paragraph({
      children: [new TextRun({ text: isoDate(), size: 20, color: '888888' })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'CONFIDENTIAL — DRAFT CREDIT MEMORANDUM', bold: true, size: 18, color: '888888' })],
      spacing: { after: 0 },
    }),
    wPageBreak(),
  );

  // Executive Summary
  const execText = data.deal.executive_summary?.trim();
  if (execText) {
    children.push(wHead1('Executive Summary'));
    const paras = (execText.includes('\n\n') ? execText.split('\n\n') : execText.split('\n')).filter(p => p.trim());
    paras.forEach(p => children.push(wPara(p.trim(), { spaceAfter: 160 })));
    children.push(wPageBreak());
  }

  // Financial Metrics
  children.push(wHead1('Financial Metrics'));
  if (data.score?.coverage_pct != null) {
    children.push(wPara(`Metric coverage: ${data.score.coverage_pct}% of the scoring framework was computable from the financial statements provided.`, { italics: true, color: '888888', spaceAfter: 200 }));
  }
  const scored    = data.metrics.filter(m => m.counted);
  const notScored = data.metrics.filter(m => !m.counted);

  if (scored.length > 0) {
    children.push(wHead2('Scored Metrics'));
    const mCols = [2800, 620, 620, 620, 1000, 1000, 1000];
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow(['Metric', 'Tier', 'Value', 'Grade', 'Strong', 'Adequate', 'Weak'], mCols),
        ...scored.map((r, i) => wDataRow([
          r.metric_name, r.tier, fmtVal(r.value, r.metric_name), r.grade,
          r.strong_band ?? '—', r.adequate_band ?? '—', r.weak_band ?? '—',
        ], mCols, i % 2 === 1)),
      ],
    }));
    children.push(new Paragraph({ spacing: { after: 240 } }));
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
    }));
    children.push(new Paragraph({ spacing: { after: 240 } }));
  }
  children.push(wPageBreak());

  // Analyst Commentary
  const summaryText = data.score?.summary?.trim();
  if (summaryText) {
    children.push(wHead1('Analyst Commentary'));
    summaryText.split('\n').filter(p => p.trim()).forEach(p => children.push(wPara(p.trim(), { spaceAfter: 160 })));
    children.push(wPageBreak());
  }

  // Strengths & Risks
  const strengths = data.score?.strengths ?? [];
  const risks     = data.score?.risks ?? [];
  if (strengths.length || risks.length) {
    children.push(wHead1('Strengths & Risks'));
    if (strengths.length) { children.push(wHead2('Key Strengths')); strengths.forEach(s => children.push(wBullet(s, STRONG.replace('#', '')))); }
    if (risks.length)     { children.push(wHead2('Key Risks'));     risks.forEach(r => children.push(wBullet(r, RED.replace('#', '')))); }
    children.push(wPageBreak());
  }

  // Historical Benchmark
  const bm = data.benchmarks;
  if (bm && !bm.noMapping && (bm.base?.sector || bm.base?.segment)) {
    children.push(wHead1('Historical Benchmark — SBA 7(a) Loan Data'));
    const bmCols = [2200, 700, 1600, 1600, 1200, 1360];
    const bmRows: any[] = [wHdrRow(['Cohort', 'N Loans', 'Default Rate (Normal)', 'Default Rate (Stress)', 'LGD (Normal)', 'LGD (Stress)'], bmCols)];
    if (bm.base?.sector && bm.stress?.sector) {
      bmRows.push(wDataRow([
        `Sector — NAICS ${bm.base.sector.naics2}`,
        (bm.base.sector.n_loans ?? '—').toLocaleString(),
        pct(bm.base.sector.default_rate), pct(bm.stress?.sector?.default_rate),
        pct(bm.base.sector.lgd), pct(bm.stress?.sector?.lgd),
      ], bmCols, false));
    }
    if (bm.base?.segment && bm.stress?.segment) {
      bmRows.push(wDataRow([
        `Segment — ${bm.base.segment.size_band} / ${bm.base.segment.term_band}`,
        (bm.base.segment.n_loans ?? '—').toLocaleString(),
        pct(bm.base.segment.default_rate), pct(bm.stress?.segment?.default_rate),
        pct(bm.base.segment.lgd), pct(bm.stress?.segment?.lgd),
      ], bmCols, true));
    }
    children.push(new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: bmRows }));
    children.push(new Paragraph({ spacing: { after: 120 } }));
    children.push(wPara(`Source: SBA 7(a) loan-level data. Total sample: ${bm.totalN?.toLocaleString() ?? '—'} loans.`, { italics: true, color: '888888', spaceAfter: 0 }));
    children.push(wPageBreak());
  }

  // Sources & Uses
  const suEntries = data.suEntries ?? [];
  if (suEntries.length) {
    const uses    = suEntries.filter(e => e.side === 'use');
    const sources = suEntries.filter(e => e.side === 'source');
    const totalU  = uses.reduce((s, e) => s + Number(e.amount), 0);
    const totalS  = sources.reduce((s, e) => s + Number(e.amount), 0);
    const suCols  = [2400, 1000, 2400, 1000];
    const suRows: any[] = [wHdrRow(['Use of Funds', 'Amount', 'Source of Funds', 'Amount'], suCols)];
    const maxLen = Math.max(uses.length, sources.length);
    for (let i = 0; i < maxLen; i++) {
      suRows.push(wDataRow([uses[i]?.label ?? '', uses[i] ? fmtMoney(Number(uses[i].amount)) : '', sources[i]?.label ?? '', sources[i] ? fmtMoney(Number(sources[i].amount)) : ''], suCols, i % 2 === 1));
    }
    suRows.push(wTotalRow(['Total Uses', fmtMoney(totalU), 'Total Sources', fmtMoney(totalS)], suCols));
    children.push(wHead1('Sources & Uses'));
    children.push(new Table({ width: { size: TW_CONT, type: WidthType.DXA }, rows: suRows }));
    children.push(new Paragraph({ spacing: { after: 240 } }));
  }

  // Capitalization
  const capItems = data.capItems ?? [];
  if (capItems.length) {
    const capCols = [1600, 3160, 1400, 800];
    children.push(wHead1('Capitalization'));
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow(['Category', 'Description', 'Amount', 'Rate'], capCols),
        ...capItems.map((it, i) => wDataRow([it.category, it.label, fmtMoney(Number(it.amount)), it.rate ? `${it.rate}%` : '—'], capCols, i % 2 === 1)),
      ],
    }));
    children.push(new Paragraph({ spacing: { after: 240 } }));
  }

  // Collateral
  const collateral = data.collateral ?? [];
  if (collateral.length) {
    const collCols = [1300, 2100, 1440, 1200, 1620];
    const totalL   = collateral.reduce((s, it) => s + Number(it.lending_value), 0);
    children.push(wHead1('Collateral'));
    children.push(new Table({
      width: { size: TW_CONT, type: WidthType.DXA },
      rows: [
        wHdrRow(['Asset Type', 'Description', 'Market Value', 'Advance Rate', 'Lending Value'], collCols),
        ...collateral.map((it, i) => wDataRow([
          it.asset_type, it.description ?? '—',
          fmtMoney(Number(it.market_value)), `${Math.round((it.advance_rate ?? 0) * 100)}%`,
          fmtMoney(Number(it.lending_value)),
        ], collCols, i % 2 === 1)),
        wTotalRow(['Total Lending Value', '', '', '', fmtMoney(totalL)], collCols),
      ],
    }));
    children.push(new Paragraph({ spacing: { after: 240 } }));
  }

  // Diligence Questions
  if (questions.length) {
    children.push(wPageBreak(), wHead1('Annex A — Diligence Questions'));
    questions.forEach((q, i) => {
      const tag = [q.priority?.toUpperCase(), q.source].filter(Boolean).join(' · ');
      children.push(wPara(`Q${i + 1}. ${q.question_text}${tag ? `  [${tag}]` : ''}`, { bold: true, spaceAfter: 60 }));
      if (q.related_metric) children.push(wPara(`Related metric: ${q.related_metric}`, { italics: true, color: '888888', spaceAfter: 60 }));
      if (q.answer?.trim()) {
        children.push(wPara('Response:', { bold: true, spaceAfter: 40 }));
        children.push(wPara(q.answer.trim(), { spaceAfter: 60 }));
        if (q.answer_assessment?.trim()) children.push(wPara(`Assessment: ${q.answer_assessment.trim()}`, { italics: true, color: '888888', spaceAfter: 60 }));
      } else {
        children.push(wPara(`Status: ${q.status ?? 'pending'}`, { italics: true, color: '888888', spaceAfter: 60 }));
      }
      if (i < questions.length - 1) children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D8D2C8' } }, spacing: { after: 120 } }));
    });
    children.push(new Paragraph({ spacing: { after: 240 } }));
  }

  // Methodology
  children.push(wPageBreak(), wHead1('Methodology Note'));
  children.push(wHead2('Scoring Framework'));
  children.push(wPara('The credit score is computed by a deterministic, rule-based engine applied to confirmed financial statement data. Each metric is evaluated against a three-band threshold (Strong / Adequate / Weak) and weighted by tier. No large language model participates in computing the numeric score.', { spaceAfter: 160 }));
  children.push(wHead2('Metric Tiers'));
  children.push(wPara('Critical metrics (T1) carry the highest weight and can trigger a floor cap: if two or more grade Weak, or one grades Weak with high severity, the score is capped at 49. Significant (T2) and Supplementary (T3) metrics carry progressively lower weights.', { spaceAfter: 160 }));
  children.push(wHead2('Disclaimer'));
  children.push(wPara('This memorandum is a draft analytical output prepared for internal underwriting review. It does not constitute a credit approval, commitment to lend, or investment advice. All figures are subject to verification.', { italics: true, color: '888888', spaceAfter: 0 }));

  // Assemble document
  const borrower = data.deal.title ?? 'Credit Memorandum';
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: TWIP_PG, height: 15840 },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: borrower, size: 16, color: '888888' }),
              new TextRun({ text: '\t\t\t\t\tCONFIDENTIAL', size: 14, color: 'AAAAAA' }),
            ],
            spacing: { after: 0 },
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: 16, color: '888888' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '888888' }),
              new TextRun({ text: ' of ', size: 16, color: '888888' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '888888' }),
            ],
            spacing: { before: 0, after: 0 },
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = memoFilename(data.deal.title, 'docx');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
