import type { jsPDF, jsPDFOptions } from 'jspdf';

/**
 * Direction artistique rapport — alignée sur la charte OnScen (app dark violet→rose).
 * Fond quasi-noir (#0B0B0F, identique à l'écran de boot), accent violet #7C3AED
 * (couleur `theme-color` de l'app) avec dégradé vers rose #EC4899 (logo / CTA app).
 */
export const PDF_THEME = {
  paper: [11, 11, 15] as [number, number, number],
  card: [22, 18, 31] as [number, number, number],
  tableStripe: [27, 22, 40] as [number, number, number],
  ink: [245, 243, 255] as [number, number, number],
  inkMuted: [168, 162, 196] as [number, number, number],
  line: [46, 39, 72] as [number, number, number],
  accent: [124, 58, 237] as [number, number, number],
  accentLight: [167, 139, 250] as [number, number, number],
  accentAlt: [236, 72, 153] as [number, number, number],
};

/** @deprecated Utiliser PDF_THEME.accent — conservé pour imports existants. */
export const ONSCEN_PDF_HEAD: [number, number, number] = PDF_THEME.accent;

export const PDF_LAYOUT = {
  margin: 16,
  /** Marge gauche du contenu (après bande latérale). */
  contentLeft: 20,
  marginRight: 16,
  stripeWidth: 5,
};

export type PdfDocWithTable = jsPDF & { lastAutoTable: { finalY: number } };

/**
 * Espaces Unicode "fines"/insécables (ex: narrow no-break space U+202F que
 * `Intl.NumberFormat('fr-FR')` insère entre les groupes de milliers, ou NBSP
 * U+00A0 avant les symboles monétaires) qui ne sont PAS correctement gérés par
 * les polices standard jsPDF (WinAnsiEncoding, cf. Helvetica) : le caractère
 * n'existe pas dans la table d'encodage et se retrouve tronqué à son octet bas
 * — U+202F (0x202F) devient l'octet 0x2F, soit le glyphe "/" ("12 434" → "12/434").
 * On neutralise systématiquement ces espaces en espace ASCII simple avant tout
 * rendu ou mesure de texte dans un PDF.
 */
const PDF_UNSAFE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;

/** Nettoie récursivement une chaîne (ou un tableau de lignes) des espaces Unicode à risque. */
export function pdfSafeText<T>(value: T): T {
  if (typeof value === 'string') return value.replace(PDF_UNSAFE_SPACES, ' ') as unknown as T;
  if (Array.isArray(value)) return (value as unknown[]).map((v) => pdfSafeText(v)) as unknown as T;
  return value;
}

/**
 * Fabrique un jsPDF dont `.text()` / `.splitTextToSize()` / `.getStringUnitWidth()`
 * sont blindés par `pdfSafeText`. À utiliser à la place de `new jsPDF(...)` dans
 * tous les modules de génération de rapport : la protection couvre aussi bien les
 * appels directs que jspdf-autotable, qui s'appuie en interne sur `doc.text()`
 * pour dessiner le contenu des cellules — un seul point de blindage suffit donc
 * pour tout le pipeline (KPI, insights, tableaux, légendes, couverture…).
 */
export function createPdfDoc(JsPdfCtor: new (opts?: jsPDFOptions) => jsPDF, opts?: jsPDFOptions): jsPDF {
  const doc = new JsPdfCtor(opts);
  // Repeint le fond sombre OnScen sur CHAQUE nouvelle page, y compris celles
  // ajoutées automatiquement par jspdf-autotable lors de sauts de page internes
  // (tableau trop long) — sans ce hook, ces pages restent blanches par défaut
  // et le texte clair de notre thème devient illisible dessus.
  doc.internal.events.subscribe('addPage', () => {
    paintPdfPageBackground(doc);
  });
  const originalText = doc.text.bind(doc);
  doc.text = ((text: string | string[], x: number, y: number, options?: unknown, transform?: unknown) =>
    originalText(pdfSafeText(text), x, y, options as never, transform as never)) as typeof doc.text;
  const originalSplit = doc.splitTextToSize.bind(doc);
  doc.splitTextToSize = ((text: string, maxlen: number, options?: unknown) =>
    originalSplit(pdfSafeText(text), maxlen, options)) as typeof doc.splitTextToSize;
  const originalWidth = doc.getStringUnitWidth.bind(doc);
  doc.getStringUnitWidth = ((text: string, options?: unknown) =>
    originalWidth(pdfSafeText(text), options)) as typeof doc.getStringUnitWidth;
  return doc;
}

export function fmtNum(value: number, locale: string): string {
  return pdfSafeText(new Intl.NumberFormat(locale).format(value));
}

export function fmtEuro(value: number, locale: string): string {
  return pdfSafeText(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value));
}

export function fmtUsd(value: number, locale: string): string {
  return pdfSafeText(new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(value));
}

export function fmtPct(value: number, locale: string): string {
  return pdfSafeText(`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} %`);
}

/** Colonnes numériques d'un tableau autoTable alignées à droite (chiffres). */
export function pdfNumericColumnStyles(indices: number[]): Record<number, { halign: 'right' }> {
  const out: Record<number, { halign: 'right' }> = {};
  for (const i of indices) out[i] = { halign: 'right' };
  return out;
}

/** Dégradé violet → rose (charte OnScen) peint par bandes fines — jsPDF n'a pas de gradient natif. */
export function drawGradientBar(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: {
    vertical?: boolean;
    from?: [number, number, number];
    to?: [number, number, number];
    steps?: number;
  }
): void {
  const from = opts?.from ?? PDF_THEME.accent;
  const to = opts?.to ?? PDF_THEME.accentAlt;
  const vertical = opts?.vertical ?? false;
  const span = vertical ? h : w;
  const steps = Math.max(6, Math.min(80, opts?.steps ?? Math.round(span * 1.4)));
  for (let i = 0; i < steps; i++) {
    const t = steps > 1 ? i / (steps - 1) : 0;
    const r = Math.round(from[0] + (to[0] - from[0]) * t);
    const g = Math.round(from[1] + (to[1] - from[1]) * t);
    const b = Math.round(from[2] + (to[2] - from[2]) * t);
    doc.setFillColor(r, g, b);
    if (vertical) {
      const segH = h / steps;
      doc.rect(x, y + segH * i, w, segH + 0.3, 'F');
    } else {
      const segW = w / steps;
      doc.rect(x + segW * i, y, segW + 0.3, h, 'F');
    }
  }
}

/** Cercle en aplat semi-transparent — écho des halos du logo OnScen. Best-effort (ignore si non supporté). */
function drawSoftBlob(doc: jsPDF, cx: number, cy: number, r: number, color: [number, number, number], opacity: number): void {
  const docWithGState = doc as jsPDF & { GState?: (o: Record<string, number>) => unknown; setGState?: (g: unknown) => void };
  try {
    if (docWithGState.GState && docWithGState.setGState) {
      docWithGState.setGState(docWithGState.GState({ opacity }));
    }
    doc.setFillColor(...color);
    doc.circle(cx, cy, r, 'F');
  } catch {
    // API opacité indisponible — on ignore silencieusement le halo décoratif.
  } finally {
    try {
      if (docWithGState.GState && docWithGState.setGState) {
        docWithGState.setGState(docWithGState.GState({ opacity: 1 }));
      }
    } catch {
      /* noop */
    }
  }
}

export function paintPdfPageBackground(doc: jsPDF): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PDF_THEME.paper);
  doc.rect(0, 0, pageW, pageH, 'F');
  drawGradientBar(doc, 0, 0, PDF_LAYOUT.stripeWidth, pageH, { vertical: true });
}

/** Couverture pleine page — wordmark OnScen, dégradé signature, carte métadonnées. */
export function drawReportCover(
  doc: jsPDF,
  opts: {
    title: string;
    subtitle: string;
    generatedAtLabel: string;
    generatedAt: string;
    scopeLine: string;
    confidential: string;
  }
): void {
  paintPdfPageBackground(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = PDF_LAYOUT.contentLeft;
  const maxW = pageW - PDF_LAYOUT.contentLeft - PDF_LAYOUT.marginRight;

  drawSoftBlob(doc, pageW - 18, 28, 34, PDF_THEME.accent, 0.16);
  drawSoftBlob(doc, pageW - 40, 12, 20, PDF_THEME.accentAlt, 0.14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.accentLight);
  doc.text('ONSCEN · RAPPORT', x, 32);

  doc.setTextColor(...PDF_THEME.ink);
  doc.setFontSize(21);
  const titleLines = doc.splitTextToSize(pdfSafeText(opts.title), maxW);
  doc.text(titleLines, x, 46);

  const ruleY = 46 + titleLines.length * 8 + 5;
  drawGradientBar(doc, x, ruleY - 1.4, Math.min(46, maxW * 0.35), 2.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_THEME.inkMuted);
  const subLines = doc.splitTextToSize(pdfSafeText(opts.subtitle), maxW);
  doc.text(subLines, x, ruleY + 11);

  const cardH = 36;
  const cardY = pageH - cardH - 22;
  doc.setFillColor(...PDF_THEME.card);
  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, cardY, maxW, cardH, 2.5, 2.5, 'FD');
  drawGradientBar(doc, x, cardY, 1.6, cardH, { vertical: true });

  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text(pdfSafeText(`${opts.generatedAtLabel} ${opts.generatedAt}`), x + 6, cardY + 10);
  doc.setTextColor(...PDF_THEME.inkMuted);
  doc.text(pdfSafeText(opts.scopeLine), x + 6, cardY + 18, { maxWidth: maxW - 12 });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text(pdfSafeText(opts.confidential), x + 6, cardY + 28, { maxWidth: maxW - 12 });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_THEME.ink);
}

/** @deprecated Alias — couverture charte OnScen. */
export function drawOnScenCover(
  doc: jsPDF,
  _margin: number,
  opts: Parameters<typeof drawReportCover>[1]
): number {
  drawReportCover(doc, opts);
  return PDF_LAYOUT.contentLeft;
}

/**
 * Bandeau d'en-tête discret pour les pages de contenu : nom OnScen à gauche,
 * titre de la section en cours à droite. Absent de la page de garde (design dédié).
 */
export function pdfPageHeader(doc: jsPDF, sectionLabel: string): number {
  const pageW = doc.internal.pageSize.getWidth();
  const x = PDF_LAYOUT.contentLeft;
  const rightX = pageW - PDF_LAYOUT.marginRight;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.accentLight);
  doc.text('ONSCEN', x, 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_THEME.inkMuted);
  doc.text(pdfSafeText(sectionLabel.toUpperCase()), rightX, 13.5, { align: 'right' });
  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.15);
  doc.line(x, 16.5, rightX, 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_THEME.ink);
  return 24;
}

export function pdfBeginContentPage(doc: jsPDF, sectionLabel?: string): number {
  doc.addPage();
  paintPdfPageBackground(doc);
  if (sectionLabel) return pdfPageHeader(doc, sectionLabel);
  return PDF_LAYOUT.contentLeft + 6;
}

/**
 * Garantit `neededH` mm d'espace avant le bas de page utile (page-break-inside:
 * avoid appliqué manuellement) — sinon démarre une nouvelle page (avec en-tête
 * si fourni) avant de dessiner le bloc suivant (graphique, tableau…).
 */
export function pdfEnsureSpace(doc: jsPDF, y: number, neededH: number, sectionLabel?: string): number {
  if (y + neededH > 268) {
    return pdfBeginContentPage(doc, sectionLabel);
  }
  return y;
}

export function pdfSectionTitle(
  doc: jsPDF,
  y: number,
  _margin: number,
  maxW: number,
  title: string
): number {
  const x = PDF_LAYOUT.contentLeft;
  if (y > 262) {
    doc.addPage();
    paintPdfPageBackground(doc);
    y = PDF_LAYOUT.contentLeft + 6;
  }
  drawGradientBar(doc, x, y - 3.5, 2.2, 9, { vertical: true });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_THEME.ink);
  doc.text(pdfSafeText(title.toUpperCase()), x + 5, y + 2.5);
  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.15);
  doc.line(x, y + 6, x + maxW - (PDF_LAYOUT.contentLeft - PDF_LAYOUT.margin), y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  return y + 12;
}

export function pdfInsightBlock(
  doc: jsPDF,
  y: number,
  _margin: number,
  maxW: number,
  lines: string[],
  sectionLabel?: string
): number {
  if (lines.length === 0) return y;
  const x = PDF_LAYOUT.contentLeft;
  const innerW = maxW - (PDF_LAYOUT.contentLeft - PDF_LAYOUT.margin);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const lineH = doc.getLineHeight() + 0.3; // hauteur réelle de ligne à cette taille (jsPDF), + interligne léger
  let totalH = 8;
  const blocks: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const split = doc.splitTextToSize(pdfSafeText(lines[i]), innerW - 14);
    const rows = Array.isArray(split) ? split : [split];
    blocks.push(rows);
    totalH += rows.length * lineH + 2.5;
  }
  if (y + totalH > 275) {
    y = pdfBeginContentPage(doc, sectionLabel);
  }
  doc.setFillColor(...PDF_THEME.card);
  doc.setDrawColor(...PDF_THEME.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, innerW, totalH, 2, 2, 'FD');
  drawGradientBar(doc, x, y + 1.5, 1.4, totalH - 3, { vertical: true });

  let innerY = y + 7;
  doc.setTextColor(...PDF_THEME.ink);
  for (let i = 0; i < blocks.length; i++) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_THEME.accentLight);
    doc.text(String(i + 1).padStart(2, '0'), x + 4, innerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_THEME.ink);
    doc.text(blocks[i], x + 12, innerY);
    innerY += blocks[i].length * lineH + 2.5;
  }
  doc.setTextColor(...PDF_THEME.ink);
  return y + totalH + 8;
}

/** @deprecated Préférer pdfInsightBlock. */
export function pdfBulletBlock(
  doc: jsPDF,
  y: number,
  margin: number,
  maxW: number,
  lines: string[]
): number {
  return pdfInsightBlock(doc, y, margin, maxW, lines);
}

const KPI_UP_COLOR: [number, number, number] = [52, 211, 153]; // emerald-400 (cohérent web AdminAnalyticsKpiCard)
const KPI_DOWN_COLOR: [number, number, number] = [248, 113, 113]; // red-400

/**
 * 4 KPI en bandeau horizontal. `deltaPct` (optionnel) affiche la variation vs
 * période précédente en couleur (vert = hausse, rouge = baisse) sous la valeur —
 * `invert: true` inverse la lecture couleur pour les indicateurs où une baisse
 * est positive (ex : taux de crash, churn).
 */
export function pdfKpiGrid(
  doc: jsPDF,
  y: number,
  _margin: number,
  maxW: number,
  cards: { label: string; value: string; deltaPct?: number; invert?: boolean }[]
): number {
  const x = PDF_LAYOUT.contentLeft;
  const innerW = maxW - (PDF_LAYOUT.contentLeft - PDF_LAYOUT.margin);
  if (y > 246) {
    doc.addPage();
    paintPdfPageBackground(doc);
    y = PDF_LAYOUT.contentLeft + 6;
  }
  const gap = 3;
  const n = Math.min(4, cards.length);
  const cellW = (innerW - gap * (n - 1)) / n;
  const cellH = 24;
  cards.slice(0, n).forEach((card, i) => {
    const cx = x + i * (cellW + gap);
    doc.setFillColor(...PDF_THEME.card);
    doc.setDrawColor(...PDF_THEME.line);
    doc.setLineWidth(0.2);
    doc.roundedRect(cx, y, cellW, cellH, 1.5, 1.5, 'FD');
    drawGradientBar(doc, cx, y, cellW, 1.3);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_THEME.inkMuted);
    doc.text(pdfSafeText(card.label), cx + 2.8, y + 7, { maxWidth: cellW - 5.5 });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.setTextColor(...PDF_THEME.ink);
    doc.text(pdfSafeText(card.value), cx + 2.8, y + 16.5, { maxWidth: cellW - 5.5 });
    if (typeof card.deltaPct === 'number' && Number.isFinite(card.deltaPct)) {
      const isUp = card.deltaPct >= 0;
      const positive = card.invert ? !isUp : isUp;
      const color = positive ? KPI_UP_COLOR : KPI_DOWN_COLOR;
      const ty = y + 21.5;
      // Petit triangle vectoriel (▲/▼) — évite les glyphes flèche Unicode non
      // supportés par les polices standard WinAnsi (mêmes risques de corruption
      // que les espaces fines, cf. pdfSafeText).
      doc.setFillColor(...color);
      if (isUp) doc.triangle(cx + 2.8, ty - 2.6, cx + 5.2, ty - 2.6, cx + 4, ty - 5.4, 'F');
      else doc.triangle(cx + 2.8, ty - 5.2, cx + 5.2, ty - 5.2, cx + 4, ty - 2.4, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...color);
      doc.text(`${isUp ? '+' : ''}${card.deltaPct.toFixed(1).replace('.', ',')} %`, cx + 6.4, ty);
    }
  });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...PDF_THEME.ink);
  return y + cellH + 10;
}

export function defaultAutoTableHeadStyles() {
  return {
    fillColor: PDF_THEME.card,
    textColor: PDF_THEME.ink,
    fontStyle: 'bold' as const,
    lineWidth: { bottom: 0.5 },
    lineColor: PDF_THEME.accent,
  };
}

export function pdfAutoTablePreset(fontSize = 9) {
  return {
    theme: 'plain' as const,
    styles: {
      fontSize,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
      textColor: PDF_THEME.ink,
      lineColor: PDF_THEME.line,
      lineWidth: 0.1,
    },
    headStyles: defaultAutoTableHeadStyles(),
    alternateRowStyles: { fillColor: PDF_THEME.tableStripe },
  };
}

export function pdfTableMargins() {
  return { left: PDF_LAYOUT.contentLeft, right: PDF_LAYOUT.marginRight };
}

/** Ligne d'évolution (aire + tracé) — vectoriel, pour graphiques embarqués dans le PDF. */
export function pdfLineChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  values: number[],
  opts?: {
    color?: [number, number, number];
    fill?: boolean;
    /** Libellés d'axe X (même longueur que `values`) — seuls le premier et le dernier sont affichés. */
    xLabels?: string[];
    /** Formatte les valeurs min/max affichées au-dessus du graphique (légende d'axe Y). */
    formatValue?: (v: number) => string;
  }
): void {
  if (values.length === 0) return;
  const color = opts?.color ?? PDF_THEME.accentLight;
  // Échelle Y ajustée à la plage réelle des données (+ léger padding) plutôt
  // que forcée à 0 : une série qui varie peu autour d'une valeur élevée (ex.
  // MAU ~12k) doit montrer sa variation, pas s'écraser en ligne quasi plate
  // en haut d'un graphique dont le plancher serait artificiellement à 0.
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = Math.max((rawMax - rawMin) * 0.12, rawMax * 0.02, 1);
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;
  const range = max - min || 1;
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;
  const pts: [number, number][] = values.map((v, i) => [
    x + i * stepX,
    y + h - ((v - min) / range) * h,
  ]);

  if (opts?.fill !== false) {
    const areaPts: [number, number][] = [...pts, [x + w, y + h], [x, y + h]];
    const rel: number[][] = [];
    for (let i = 1; i < areaPts.length; i++) {
      rel.push([areaPts[i][0] - areaPts[i - 1][0], areaPts[i][1] - areaPts[i - 1][1]]);
    }
    const gAny = doc as jsPDF & {
      GState?: (o: Record<string, number>) => unknown;
      setGState?: (g: unknown) => void;
    };
    try {
      if (gAny.GState && gAny.setGState) gAny.setGState(gAny.GState({ opacity: 0.18 }));
      doc.setFillColor(...color);
      doc.lines(rel, areaPts[0][0], areaPts[0][1], [1, 1], 'F', true);
    } catch {
      /* opacité indisponible — l'aire est simplement omise en fallback */
    } finally {
      try {
        if (gAny.GState && gAny.setGState) gAny.setGState(gAny.GState({ opacity: 1 }));
      } catch {
        /* noop */
      }
    }
  }

  doc.setDrawColor(...color);
  doc.setLineWidth(0.6);
  for (let i = 1; i < pts.length; i++) {
    doc.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  const last = pts[pts.length - 1];
  doc.setFillColor(...color);
  doc.circle(last[0], last[1], 0.9, 'F');

  // Légende d'axe : min/max (Y) au-dessus, première/dernière date (X) en dessous.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...PDF_THEME.inkMuted);
  const fmt = opts?.formatValue ?? ((v: number) => String(Math.round(v)));
  doc.text(pdfSafeText(`Max ${fmt(rawMax)}`), x, y - 2.2);
  doc.text(pdfSafeText(`Min ${fmt(rawMin)}`), x + w, y - 2.2, { align: 'right' });
  if (opts?.xLabels && opts.xLabels.length > 0) {
    doc.text(pdfSafeText(opts.xLabels[0]), x, y + h + 4.5);
    doc.text(pdfSafeText(opts.xLabels[opts.xLabels.length - 1]), x + w, y + h + 4.5, { align: 'right' });
  }
  doc.setTextColor(...PDF_THEME.ink);
}

/** Barres empilées — vectoriel. */
export function pdfStackedBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  series: { color: [number, number, number]; values: number[] }[],
  opts?: { xLabels?: string[] }
): void {
  const n = series[0]?.values.length ?? 0;
  if (n === 0) return;
  const gap = 1.2;
  const barW = (w - gap * (n - 1)) / n;
  const totals = Array.from({ length: n }, (_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(...totals, 1);
  for (let i = 0; i < n; i++) {
    const total = totals[i];
    const barH = total === 0 ? 0 : Math.max((total / max) * h, 0.4);
    let cy = y + h;
    const bx = x + i * (barW + gap);
    for (const s of series) {
      const v = s.values[i] ?? 0;
      const segH = total === 0 ? 0 : (v / total) * barH;
      if (segH > 0) {
        doc.setFillColor(...s.color);
        doc.rect(bx, cy - segH, barW, segH, 'F');
      }
      cy -= segH;
    }
  }
  if (opts?.xLabels && opts.xLabels.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_THEME.inkMuted);
    doc.text(pdfSafeText(opts.xLabels[0]), x, y + h + 4.5);
    doc.text(pdfSafeText(opts.xLabels[opts.xLabels.length - 1]), x + w, y + h + 4.5, { align: 'right' });
    doc.setTextColor(...PDF_THEME.ink);
  }
}

/** Barres simples (une seule série) avec libellés courts sous chaque barre — utile pour un classement (top N). */
export function pdfRankingBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  items: { label: string; value: number; color: [number, number, number] }[],
  formatValue?: (v: number) => string
): void {
  const n = items.length;
  if (n === 0) return;
  const gap = 4;
  const barW = (w - gap * (n - 1)) / n;
  const max = Math.max(...items.map((it) => it.value), 1);
  const fmt = formatValue ?? ((v: number) => String(Math.round(v)));
  items.forEach((it, i) => {
    const bx = x + i * (barW + gap);
    const barH = Math.max((it.value / max) * h, 0.6);
    doc.setFillColor(...it.color);
    doc.roundedRect(bx, y + h - barH, barW, barH, 0.6, 0.6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(...PDF_THEME.ink);
    doc.text(pdfSafeText(fmt(it.value)), bx + barW / 2, y + h - barH - 1.6, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...PDF_THEME.inkMuted);
    const label = it.label.length > 14 ? `${it.label.slice(0, 13)}…` : it.label;
    doc.text(pdfSafeText(label), bx + barW / 2, y + h + 4, { align: 'center', maxWidth: barW + gap - 1 });
  });
  doc.setTextColor(...PDF_THEME.ink);
}

/** Donut (camembert évidé) — approximation vectorielle par éventail de triangles. */
export function pdfDonutChart(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  slices: { pct: number; color: [number, number, number] }[]
): void {
  const total = slices.reduce((a, s) => a + s.pct, 0) || 1;
  let angleStart = -Math.PI / 2;
  for (const s of slices) {
    const angleSpan = (s.pct / total) * Math.PI * 2;
    const segments = Math.max(2, Math.round(((angleSpan * 180) / Math.PI) / 4));
    doc.setFillColor(...s.color);
    for (let k = 0; k < segments; k++) {
      const a1 = angleStart + (angleSpan * k) / segments;
      const a2 = angleStart + (angleSpan * (k + 1)) / segments;
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
    }
    angleStart += angleSpan;
  }
  doc.setFillColor(...PDF_THEME.card);
  doc.circle(cx, cy, r * 0.55, 'F');
}

/** Légende compacte (puce + libellé [+ valeur]) pour un graphique vectoriel. */
export function pdfChartLegend(
  doc: jsPDF,
  x: number,
  y: number,
  items: { label: string; color: [number, number, number]; value?: string }[]
): number {
  let cx = x;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  for (const item of items) {
    const label = item.value ? `${item.label} · ${item.value}` : item.label;
    const safeLabel = pdfSafeText(label);
    doc.setFillColor(...item.color);
    doc.roundedRect(cx, y - 2.6, 2.6, 2.6, 0.5, 0.5, 'F');
    doc.setTextColor(...PDF_THEME.inkMuted);
    const textW = doc.getTextWidth(safeLabel);
    doc.text(safeLabel, cx + 4, y);
    cx += 4 + textW + 6;
  }
  doc.setTextColor(...PDF_THEME.ink);
  return y;
}

/**
 * Pied de page discret sur les pages de contenu (page 1 = couverture exclue,
 * elle a son propre design). Date de génération à gauche, mention courte
 * centrée, numéro de page à droite — tout en petit gris clair.
 */
export function pdfAddFooters(doc: jsPDF, _margin: number, footerText: string, dateLabel?: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...PDF_THEME.line);
    doc.setLineWidth(0.2);
    doc.line(PDF_LAYOUT.contentLeft, 283, pageW - PDF_LAYOUT.marginRight, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.inkMuted);
    if (dateLabel) {
      doc.text(pdfSafeText(dateLabel), PDF_LAYOUT.contentLeft, 288);
    }
    doc.text(pdfSafeText(footerText), pageW / 2, 288, { align: 'center', maxWidth: pageW - 90 });
    doc.setTextColor(...PDF_THEME.ink);
    doc.text(`${i - 1} / ${pageCount - 1}`, pageW - PDF_LAYOUT.marginRight, 288, { align: 'right' });
  }
}
