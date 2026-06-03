import { useState } from 'react';
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
}

export function SalonProposalsSection({
  isHost,
  allowQueue,
  proposals,
  loadingProposals,
  onPropose,
  onAccept,
  onReject,
}: SalonProposalsSectionProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

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
      alert('Proposition envoyée au host !');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (isHost) {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-2">
          Propositions en attente
          {proposals.length > 0 && (
            <span className="bg-amber-500/20 text-amber-300 px-1.5 rounded-full">{proposals.length}</span>
          )}
        </h4>
        {loadingProposals ? (
          <p className="text-xs text-gray-500">Chargement…</p>
        ) : proposals.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-2">Aucune proposition pour le moment</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {proposals.map((p) => (
              <li key={p.id} className="p-3 rounded-xl bg-[#1a1a26] border border-amber-500/20">
                <p className="text-sm text-white font-medium">{p.title}</p>
                <p className="text-xs text-gray-400">{p.artist}</p>
                <p className="text-[10px] text-gray-500 mt-1">par {p.proposerName}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={async () => {
                      setActionId(p.id);
                      try {
                        await onAccept?.(p.id, true);
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Erreur');
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="flex-1 py-1.5 rounded-lg bg-green-600/90 text-white text-xs font-bold"
                  >
                    Accepter & lire
                  </button>
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={async () => {
                      setActionId(p.id);
                      try {
                        await onAccept?.(p.id, false);
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Erreur');
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="flex-1 py-1.5 rounded-lg border border-green-500/40 text-green-300 text-xs font-bold"
                  >
                    File
                  </button>
                  <button
                    type="button"
                    disabled={actionId === p.id}
                    onClick={async () => {
                      setActionId(p.id);
                      try {
                        await onReject?.(p.id);
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Erreur');
                      } finally {
                        setActionId(null);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 text-xs font-bold"
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
      <h4 className="text-[10px] font-bold text-purple-400 uppercase">Proposer un morceau</h4>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre"
        className="w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-sm text-white"
        required
      />
      <input
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        placeholder="Artiste"
        className="w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-sm text-white"
        required
      />
      <input
        value={spotifyUrl}
        onChange={(e) => setSpotifyUrl(e.target.value)}
        placeholder="Lien Spotify (optionnel)"
        className="w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-xs text-white"
      />
      <input
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        placeholder="Lien YouTube (optionnel)"
        className="w-full px-3 py-2 rounded-lg bg-[#1a1a26] border border-[#2d2d3d] text-xs text-white"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 rounded-xl bg-purple-600 font-bold text-white text-sm disabled:opacity-50"
      >
        {submitting ? 'Envoi…' : 'Envoyer au host'}
      </button>
    </form>
  );
}
