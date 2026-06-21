import { useEffect, useState, useMemo } from 'react';
import { LEGAL, type LegalDocument, type LegalKey } from '../content/legal';
import {
  applyPublisherTemplate,
  hasIncompleteFields,
  extractMissingFieldKeys,
  INCOMPLETE_FIELD_REGEX,
} from '../lib/applyPublisherTemplate';
import { getLegalFieldLabel } from '../content/legal/legalConfig';
import { api } from '../lib/api';
import type { LegalPublisherConfig } from '../types';

function mergeDocWithPublisher(doc: LegalDocument, config: LegalPublisherConfig): LegalDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) => ({
      ...s,
      body: applyPublisherTemplate(s.body, config),
    })),
  };
}

/**
 * Rend un paragraphe en surlignant les champs non remplis [À compléter : …]
 * en orange pour les rendre immédiatement visibles.
 */
function renderParagraphWithHighlights(text: string, paraKey: string): React.ReactNode {
  const parts = text.split(new RegExp(`(${INCOMPLETE_FIELD_REGEX.source})`, 'g'));
  return (
    <p key={paraKey}>
      {parts.map((part, j) =>
        /^\[À compléter/.test(part) ? (
          <mark
            key={j}
            className="bg-amber-500/25 text-amber-300 rounded px-1 not-italic font-mono text-[11px] border border-amber-500/30"
            title="Ce champ doit être renseigné dans msdev/legal-publisher.json"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </p>
  );
}

interface LegalDocumentViewProps {
  docKey: LegalKey;
  onBack?: () => void;
  titleClassName?: string;
  /** Renders content only (no header/scroll shell) for embedding in SettingsPage. */
  embedded?: boolean;
}

export function LegalDocumentView({ docKey, onBack, titleClassName, embedded }: LegalDocumentViewProps) {
  const staticDoc = LEGAL[docKey];
  const [doc, setDoc] = useState<LegalDocument>(staticDoc);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getLegalPublisher()
      .then((r) => {
        if (cancelled) return;
        setDoc(mergeDocWithPublisher(staticDoc, r.config));
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setDoc(staticDoc);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [docKey, staticDoc]);

  /** Champs manquants agrégés sur l'ensemble du document rendu */
  const missingFields = useMemo(() => {
    const allText = doc.sections.map((s) => s.body).join('\n');
    return extractMissingFieldKeys(allText);
  }, [doc]);

  const isIncomplete = missingFields.length > 0;

  const body = (
    <>
      <p className="text-xs text-gray-500">Mis à jour : {doc.updated}</p>

      {/* ── Bannière d'avertissement si champs non remplis ── */}
      {isIncomplete && (
        <div className="flex flex-col gap-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-3">
          <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
            <span>⚠</span>
            {docKey === 'mentions'
              ? 'Mentions légales incomplètes — infraction LCEN potentielle'
              : 'Document incomplet — champs non renseignés'}
          </p>
          <p className="text-[11px] text-amber-200/70 leading-relaxed">
            {missingFields.length} champ{missingFields.length > 1 ? 's' : ''} à compléter dans{' '}
            <code className="text-amber-200 bg-amber-500/10 rounded px-1">msdev/legal-publisher.json</code>.
            Les zones surlignées en orange ci-dessous indiquent les valeurs manquantes.
          </p>
          <ul className="mt-0.5 flex flex-col gap-0.5">
            {missingFields.map((key) => (
              <li key={key} className="text-[11px] text-amber-200/80 flex items-center gap-1">
                <span className="text-amber-500">›</span>
                <code className="font-mono text-amber-200 text-[10px]">{key}</code>
                {getLegalFieldLabel(key as Parameters<typeof getLegalFieldLabel>[0]) !== key && (
                  <span className="text-amber-200/50">
                    — {getLegalFieldLabel(key as Parameters<typeof getLegalFieldLabel>[0])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Avertissement si le serveur est inaccessible ── */}
      {loadError && (
        <p className="text-[11px] text-gray-500 bg-gray-800/40 border border-gray-700/30 rounded-xl px-3 py-2">
          Impossible de charger la configuration éditeur. Les champs variables sont affichés bruts.
        </p>
      )}

      {doc.sections.map((s) => {
        const sectionHasPlaceholders = hasIncompleteFields(s.body);
        return (
          <section
            key={s.heading}
            className={`bg-[#12121a] border rounded-xl p-4 ${
              sectionHasPlaceholders ? 'border-amber-500/25' : 'border-[#1e1e2f]'
            }`}
          >
            <h2 className="text-sm font-bold text-purple-400 mb-2">{s.heading}</h2>
            <div className="text-sm text-gray-300 leading-relaxed space-y-2">
              {s.body.split('\n\n').map((paragraph, i) =>
                hasIncompleteFields(paragraph)
                  ? renderParagraphWithHighlights(paragraph, `${s.heading}-${i}`)
                  : <p key={i}>{paragraph}</p>
              )}
            </div>
          </section>
        );
      })}
    </>
  );

  if (embedded) {
    return <div className="p-4 space-y-4">{body}</div>;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      {onBack && (
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f]">
          <button type="button" onClick={onBack} className="text-gray-400 hover:text-white text-xl">
            ←
          </button>
          <h1 className={`font-bold text-white text-sm ${titleClassName ?? ''}`}>{doc.title}</h1>
        </header>
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {body}
      </div>
    </div>
  );
}
