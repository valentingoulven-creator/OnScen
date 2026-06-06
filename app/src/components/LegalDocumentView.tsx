import { useEffect, useState } from 'react';
import { LEGAL, type LegalDocument, type LegalKey } from '../content/legal';
import { applyPublisherTemplate } from '../lib/applyPublisherTemplate';
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

interface LegalDocumentViewProps {
  docKey: LegalKey;
  onBack?: () => void;
  titleClassName?: string;
}

export function LegalDocumentView({ docKey, onBack, titleClassName }: LegalDocumentViewProps) {
  const staticDoc = LEGAL[docKey];
  const [doc, setDoc] = useState<LegalDocument>(staticDoc);
  const [publisherIncomplete, setPublisherIncomplete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .getLegalPublisher()
      .then((r) => {
        if (cancelled) return;
        setPublisherIncomplete(!r.complete);
        setDoc(mergeDocWithPublisher(staticDoc, r.config));
      })
      .catch(() => {
        if (!cancelled) setDoc(staticDoc);
      });
    return () => {
      cancelled = true;
    };
  }, [docKey, staticDoc]);

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
        <p className="text-xs text-gray-500">Mis à jour : {doc.updated}</p>
        {publisherIncomplete && docKey === 'mentions' && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            Mentions légales incomplètes : remplissez le fichier{' '}
            <code className="text-amber-200">acompleter.txt</code> puis{' '}
            <code className="text-amber-200">msdev/legal-publisher.json</code>.
          </p>
        )}
        {doc.sections.map((s) => (
          <section key={s.heading} className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-4">
            <h2 className="text-sm font-bold text-purple-400 mb-2">{s.heading}</h2>
            <div className="text-sm text-gray-300 leading-relaxed space-y-2">
              {s.body.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
