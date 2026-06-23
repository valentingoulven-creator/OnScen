import { useEffect, useMemo, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { decodeProposalDisplayText, sortSalonProposals } from '../lib/salonProposals';
import type { SalonTrackProposal } from '../types';

interface SalonProposalsSectionProps {
  isHost: boolean;
  allowQueue: boolean;
  proposals: SalonTrackProposal[];
  loadingProposals?: boolean;
  currentUserId?: string;
  onPropose?: (body: {
    title: string;
    artist: string;
    youtubeUrl?: string;
  }) => Promise<void>;
  onAccept?: (proposalId: string, playNow: boolean) => Promise<void>;
  onReject?: (proposalId: string) => Promise<void>;
  onUpvote?: (proposalId: string) => Promise<void>;
  compact?: boolean;
  /** Remplit l'espace vertical restant (dock file d'attente) avec défilement interne. */
  fillHeight?: boolean;
}

function ProposalUpvoteButton({
  proposal,
  currentUserId,
  onUpvote,
  disabled,
  hostView,
}: {
  proposal: SalonTrackProposal;
  currentUserId?: string;
  onUpvote?: (proposalId: string) => Promise<void>;
  disabled?: boolean;
  hostView?: boolean;
}) {
  const [upvoting, setUpvoting] = useState(false);
  const count = proposal.upvotes?.length ?? 0;
  const hasUpvoted = Boolean(currentUserId && proposal.upvotes?.includes(currentUserId));

  if (!onUpvote) return null;

  return (
    <button
      type="button"
      disabled={disabled || upvoting}
      onClick={async () => {
        setUpvoting(true);
        try {
          await onUpvote(proposal.id);
        } finally {
          setUpvoting(false);
        }
      }}
      className={`shrink-0 flex flex-col items-center justify-center min-w-[2rem] px-1 py-0.5 rounded-lg border transition disabled:opacity-50 ${
        hasUpvoted
          ? hostView
            ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
            : 'border-purple-400/50 bg-purple-500/15 text-purple-300'
          : hostView
            ? 'border-amber-500/20 text-gray-500 hover:border-amber-400/40 hover:text-amber-300 hover:bg-amber-500/10'
            : 'border-[#2a2a3a] text-gray-500 hover:border-purple-400/40 hover:text-purple-300 hover:bg-purple-500/10'
      }`}
      aria-pressed={hasUpvoted}
      aria-label={hasUpvoted ? 'Retirer votre vote' : 'Voter pour cette proposition'}
      title={hasUpvoted ? 'Retirer votre vote' : 'Voter pour cette proposition'}
    >
      <span className="text-[10px] leading-none" aria-hidden="true">
        ▲
      </span>
      <span className="text-[10px] font-bold leading-tight tabular-nums">{count}</span>
    </button>
  );
}

export function SalonProposalsSection({
  isHost,
  allowQueue,
  proposals,
  loadingProposals,
  currentUserId,
  onPropose,
  onAccept,
  onReject,
  onUpvote,
  compact,
  fillHeight = false,
}: SalonProposalsSectionProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sortedProposals = useMemo(() => sortSalonProposals(proposals), [proposals]);

  useEffect(() => {
    if (!successMsg) return;
    const id = window.setTimeout(() => setSuccessMsg(null), 3000);
    return () => window.clearTimeout(id);
  }, [successMsg]);

  useEffect(() => {
    if (!errorMsg) return;
    const id = window.setTimeout(() => setErrorMsg(null), 3000);
    return () => window.clearTimeout(id);
  }, [errorMsg]);

  if (!allowQueue) return null;

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPropose || !title.trim() || !artist.trim()) return;
    setSubmitting(true);
    try {
      await onPropose({
        title: title.trim(),
        artist: artist.trim(),
        youtubeUrl: youtubeUrl.trim() || undefined,
      });
      setTitle('');
      setArtist('');
      setYoutubeUrl('');
      setSuccessMsg('Proposition envoyée');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const rootClassName = fillHeight
    ? 'flex flex-col flex-1 min-h-0 gap-2'
    : 'space-y-2';
  const listClassName = fillHeight
    ? 'flex-1 min-h-0 space-y-1.5 overflow-y-auto overscroll-contain'
    : `space-y-1.5 overflow-y-auto ${compact ? 'max-h-36' : 'max-h-48'}`;

  if (isHost) {
    return (
      <div className={rootClassName}>
        {errorMsg && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5 shrink-0">{errorMsg}</p>
        )}
        <h4 className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wide flex items-center gap-2 shrink-0">
          Propositions
          {sortedProposals.length > 0 && (
            <span className="bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {sortedProposals.length}
            </span>
          )}
        </h4>
        {loadingProposals ? (
          <p className="text-xs text-gray-500 shrink-0">Chargement…</p>
        ) : sortedProposals.length === 0 ? (
          <p className={`text-gray-600 text-center shrink-0 ${compact ? 'text-[10px] py-1' : 'text-xs py-2'}`}>
            Aucune proposition
          </p>
        ) : (
          <ul className={listClassName}>
            {sortedProposals.map((p) => (
              <li key={p.id} className="p-2.5 rounded-xl bg-[#0b0b0f] border border-amber-500/15">
                <div className="flex items-start gap-2 min-w-0">
                  <ProposalUpvoteButton
                    proposal={p}
                    currentUserId={currentUserId}
                    onUpvote={onUpvote}
                    disabled={actionId === p.id}
                    hostView
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium break-words leading-snug">
                      {decodeProposalDisplayText(p.title)}
                    </p>
                    <p className="text-[10px] text-gray-500 break-words leading-snug">
                      {decodeProposalDisplayText(p.artist)} · {p.proposerName}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={async () => {
                      setActionId(p.id);
                      try {
                        await onAccept?.(p.id, true);
                      } catch (e) {
                        setErrorMsg(e instanceof Error ? e.message : 'Erreur');
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="flex-1 py-1 rounded-lg bg-green-600/85 hover:bg-green-500 text-white text-[10px] font-semibold transition"
                  >
                    Lire
                  </button>
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={async () => {
                      setActionId(p.id);
                      try {
                        await onAccept?.(p.id, false);
                      } catch (e) {
                        setErrorMsg(e instanceof Error ? e.message : 'Erreur');
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="flex-1 py-1 rounded-lg border border-green-500/30 text-green-300 text-[10px] font-semibold hover:bg-green-500/10 transition"
                  >
                    File
                  </button>
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={() => setConfirmRejectId(p.id)}
                    className="px-2 py-1 rounded-lg border border-red-500/30 text-red-300 text-[10px] font-semibold hover:bg-red-500/10 transition"
                    aria-label="Refuser"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <ConfirmModal
          open={confirmRejectId !== null}
          title="Supprimer cette proposition ?"
          description="Elle sera définitivement refusée et retirée."
          onCancel={() => setConfirmRejectId(null)}
          onConfirm={async () => {
            if (!confirmRejectId) return;
            const id = confirmRejectId;
            setActionId(id);
            try {
              await onReject?.(id);
              setConfirmRejectId(null);
            } catch (e) {
              setErrorMsg(e instanceof Error ? e.message : 'Erreur');
            } finally {
              setActionId(null);
            }
          }}
        />
      </div>
    );
  }

  const participantListClassName = fillHeight
    ? 'flex-1 min-h-0 space-y-1.5 overflow-y-auto overscroll-contain'
    : `space-y-1.5 overflow-y-auto ${compact ? 'max-h-32' : 'max-h-40'}`;

  return (
    <div className={rootClassName}>
      {sortedProposals.length > 0 && (
        <>
          <h4 className="text-[11px] font-semibold text-purple-400/80 uppercase tracking-wide shrink-0">
            Propositions en attente
            <span className="ml-1.5 text-gray-500 normal-case tracking-normal font-medium">
              ({sortedProposals.length})
            </span>
          </h4>
          <ul className={participantListClassName}>
            {sortedProposals.map((p) => (
              <li key={p.id} className="px-2.5 py-1.5 rounded-xl bg-[#0b0b0f] border border-[#222233] flex items-start gap-2 min-w-0">
                <ProposalUpvoteButton
                  proposal={p}
                  currentUserId={currentUserId}
                  onUpvote={onUpvote}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white break-words leading-snug">
                    {decodeProposalDisplayText(p.title)}
                  </p>
                  <p className="text-[10px] text-gray-500 break-words leading-snug">
                    {decodeProposalDisplayText(p.artist)} · {p.proposerName}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {onPropose ? (
        <form onSubmit={submitProposal} className="space-y-2 shrink-0">
          <h4 className="text-[11px] font-semibold text-purple-400 uppercase tracking-wide">Proposer un morceau</h4>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white"
            required
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artiste"
            className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-sm text-white"
            required
          />
          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Lien YouTube (optionnel)"
            className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-xs text-white"
          />
          {successMsg && (
            <p className="text-xs text-green-400 bg-green-500/10 rounded-lg px-2.5 py-1.5 text-center">{successMsg}</p>
          )}
          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5 text-center">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 font-semibold text-white text-sm disabled:opacity-50 transition"
          >
            {submitting ? 'Envoi…' : 'Envoyer au host'}
          </button>
        </form>
      ) : sortedProposals.length === 0 ? (
        allowQueue ? (
          <p className={`text-gray-600 text-center ${compact ? 'text-[10px] py-1' : 'text-xs py-2'}`}>
            Aucune proposition
          </p>
        ) : null
      ) : null}

      {!onPropose && errorMsg && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5 text-center">{errorMsg}</p>
      )}
    </div>
  );
}
