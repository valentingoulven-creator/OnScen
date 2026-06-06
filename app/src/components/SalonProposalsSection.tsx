import { useEffect, useState } from 'react';
import type { SalonTrackProposal } from '../types';

interface SalonProposalsSectionProps {
  isHost: boolean;
  allowQueue: boolean;
  proposals: SalonTrackProposal[];
  loadingProposals?: boolean;
  onPropose?: (body: {
    title: string;
    artist: string;
    spotifyUrl?: string;
    youtubeUrl?: string;
  }) => Promise<void>;
  onAccept?: (proposalId: string, playNow: boolean) => Promise<void>;
  onReject?: (proposalId: string) => Promise<void>;
  compact?: boolean;
}

export function SalonProposalsSection({
  isHost,
  allowQueue,
  proposals,
  loadingProposals,
  onPropose,
  onAccept,
  onReject,
  compact,
}: SalonProposalsSectionProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        spotifyUrl: spotifyUrl.trim() || undefined,
        youtubeUrl: youtubeUrl.trim() || undefined,
      });
      setTitle('');
      setArtist('');
      setSpotifyUrl('');
      setYoutubeUrl('');
      setSuccessMsg('Proposition envoyée au host !');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (isHost) {
    return (
      <div className="space-y-2">
        {errorMsg && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5">{errorMsg}</p>
        )}
        <h4 className="text-[11px] font-semibold text-amber-400/90 uppercase tracking-wide flex items-center gap-2">
          Propositions
          {proposals.length > 0 && (
            <span className="bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {proposals.length}
            </span>
          )}
        </h4>
        {loadingProposals ? (
          <p className="text-xs text-gray-500">Chargement…</p>
        ) : proposals.length === 0 ? (
          <p className={`text-gray-600 text-center ${compact ? 'text-[10px] py-1' : 'text-xs py-2'}`}>
            Aucune proposition
          </p>
        ) : (
          <ul className={`space-y-1.5 overflow-y-auto ${compact ? 'max-h-36' : 'max-h-48'}`}>
            {proposals.map((p) => (
              <li key={p.id} className="p-2.5 rounded-xl bg-[#0b0b0f] border border-amber-500/15">
                <p className="text-xs text-white font-medium truncate">{p.title}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {p.artist} · {p.proposerName}
                </p>
                <div className="flex gap-1.5 mt-2">
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
                    onClick={async () => {
                      if (!window.confirm('Refuser cette proposition ? Elle sera définitivement supprimée.')) return;
                      setActionId(p.id);
                      try {
                        await onReject?.(p.id);
                      } catch (e) {
                        setErrorMsg(e instanceof Error ? e.message : 'Erreur');
                      } finally {
                        setActionId(null);
                      }
                    }}
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
      </div>
    );
  }

  return (
    <form onSubmit={submitProposal} className="space-y-2">
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
        value={spotifyUrl}
        onChange={(e) => setSpotifyUrl(e.target.value)}
        placeholder="Lien Spotify (optionnel)"
        className="w-full px-3 py-2 rounded-xl bg-[#0b0b0f] border border-[#2a2a3a] text-xs text-white"
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
  );
}
