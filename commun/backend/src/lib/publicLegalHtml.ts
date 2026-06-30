import { getLegalDocument } from './legalDocuments';
import type { AppLocale } from './requestLocale';

const PUBLIC_LEGAL_ROUTES: Record<string, string> = {
  privacy: 'privacy',
  terms: 'terms',
  cookies: 'cookies',
  'legal/mentions': 'mentions',
};

const UI: Record<AppLocale, {
  updated: string;
  enNotice: string;
  footerPrivacy: string;
  footerTerms: string;
  footerMentions: string;
}> = {
  fr: {
    updated: 'Dernière mise à jour',
    enNotice: '',
    footerPrivacy: 'Confidentialité',
    footerTerms: 'CGU',
    footerMentions: 'Mentions légales',
  },
  en: {
    updated: 'Last updated',
    enNotice:
      'This document is provided in French (official version). An English translation may follow.',
    footerPrivacy: 'Privacy',
    footerTerms: 'Terms',
    footerMentions: 'Legal notice',
  },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function bodyToHtml(body: string): string {
  const paragraphs = body.split(/\n\n+/);
  return paragraphs
    .map((block) => {
      const lines = block.split('\n').map((line) => escapeHtml(line));
      return `<p>${lines.join('<br>\n')}</p>`;
    })
    .join('\n');
}

export function resolvePublicLegalDocKey(path: string): string | null {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return PUBLIC_LEGAL_ROUTES[normalized] ?? null;
}

export function renderPublicLegalHtml(docKey: string, lang: AppLocale = 'fr'): string | null {
  const doc = getLegalDocument(docKey);
  if (!doc) return null;

  const ui = UI[lang];

  const sections = doc.sections
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.heading)}</h2>\n${bodyToHtml(s.body)}</section>`
    )
    .join('\n');

  const enNotice = ui.enNotice
    ? `<p class="meta" style="margin-top:1rem;color:#c4b5fd;">${escapeHtml(ui.enNotice)}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(doc.title)} — Soundy</title>
  <meta name="description" content="${escapeHtml(doc.title)} — Soundy (getsoundy.com)">
  <style>
    :root { color-scheme: dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6; max-width: 48rem; margin: 0 auto; padding: 1.5rem; background: #0b0b0f; color: #e5e7eb; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #9ca3af; font-size: 0.875rem; margin-bottom: 2rem; }
    h2 { font-size: 1.05rem; margin-top: 1.75rem; color: #fff; }
    p { margin: 0.75rem 0; }
    a { color: #a78bfa; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1e1e2f; font-size: 0.875rem; color: #6b7280; }
    .lang-switch { font-size: 0.875rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <p class="lang-switch"><a href="?lang=fr">Français</a> · <a href="?lang=en">English</a></p>
  <header>
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="meta">Soundy · ${ui.updated} : ${escapeHtml(doc.updated)}</p>
    ${enNotice}
  </header>
  <main>
${sections}
  </main>
  <footer>
    <p><a href="https://getsoundy.com/">getsoundy.com</a> ·
    <a href="/privacy?lang=${lang}">${ui.footerPrivacy}</a> ·
    <a href="/terms?lang=${lang}">${ui.footerTerms}</a> ·
    <a href="/legal/mentions?lang=${lang}">${ui.footerMentions}</a></p>
  </footer>
</body>
</html>`;
}
