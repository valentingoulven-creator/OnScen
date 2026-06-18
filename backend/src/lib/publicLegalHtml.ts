import { getLegalDocument } from './legalDocuments';

const PUBLIC_LEGAL_ROUTES: Record<string, string> = {
  privacy: 'privacy',
  terms: 'terms',
  'legal/mentions': 'mentions',
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

export function renderPublicLegalHtml(docKey: string): string | null {
  const doc = getLegalDocument(docKey);
  if (!doc) return null;

  const sections = doc.sections
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.heading)}</h2>\n${bodyToHtml(s.body)}</section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(doc.title)} — Soundy</title>
  <meta name="description" content="${escapeHtml(doc.title)} de Soundy (getsoundy.com)">
  <style>
    :root { color-scheme: dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6; max-width: 48rem; margin: 0 auto; padding: 1.5rem; background: #0b0b0f; color: #e5e7eb; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #9ca3af; font-size: 0.875rem; margin-bottom: 2rem; }
    h2 { font-size: 1.05rem; margin-top: 1.75rem; color: #fff; }
    p { margin: 0.75rem 0; }
    a { color: #a78bfa; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #1e1e2f; font-size: 0.875rem; color: #6b7280; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="meta">Soundy · Dernière mise à jour : ${escapeHtml(doc.updated)}</p>
  </header>
  <main>
${sections}
  </main>
  <footer>
    <p><a href="https://getsoundy.com/">getsoundy.com</a> ·
    <a href="/privacy">Confidentialité</a> ·
    <a href="/terms">CGU</a> ·
    <a href="/legal/mentions">Mentions légales</a></p>
  </footer>
</body>
</html>`;
}
