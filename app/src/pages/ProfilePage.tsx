import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  MAX_PROFILE_PAYLOAD_CHARS,
  prepareProfilePhotosForSave,
  profilePhotosChanged,
} from '../lib/profilePhotos';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { ProfilePhotoGallery } from '../components/ProfilePhotoGallery';
import { SettingsPage, SettingsGearButton } from './SettingsPage';
import { SupportMeloSongTeaser } from '../components/SupportMeloSongSection';
import { ProfileReelRecorder } from '../components/ProfileReelRecorder';
import { UserReelsSection } from '../components/UserReelsSection';
import { PlatformConnectCard } from '../components/PlatformConnectCard';
import type { ListeningRole, RelationshipStatus, User } from '../types';

const ROLE_LABELS: Record<ListeningRole, string> = {
  auditeur: 'Auditeur',
  host: 'Host / DJ',
  les_deux: 'Auditeur & Host',
};

const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  celibataire: 'Célibataire',
  en_couple: 'En couple',
};

const SUGGESTED_INTERESTS = [
  'Live local',
  'Spotify Jam',
  'YouTube',
  'Découvertes',
  'Écoute partagée',
  'Chill',
  'Club',
  'Indie',
  'Hip-hop',
  'Électro',
];

function getProfilePhotos(user: User | null): string[] {
  if (user?.profilePhotos?.length) return [...user.profilePhotos];
  if (user?.avatarUrl) return [user.avatarUrl];
  return [];
}

function profileToForm(user: User | null) {
  const profilePhotos = getProfilePhotos(user);
  return {
    username: user?.username ?? '',
    bio: user?.bio ?? '',
    city: user?.city ?? '',
    avatarUrl: profilePhotos[0] ?? '',
    profilePhotos,
    listeningRole: (user?.listeningRole ?? 'auditeur') as ListeningRole,
    relationshipStatus: user?.relationshipStatus ?? '',
    interests: [...(user?.interests ?? [])],
    favoriteGenres: [...(user?.favoriteGenres ?? [])],
    favoriteArtists: [...(user?.favoriteArtists ?? [])],
    connectedPlatforms: [...(user?.connectedPlatforms ?? [])],
    newInterest: '',
    newGenre: '',
    newArtist: '',
  };
}

type ProfileTab = 'profil' | 'enregistrer';

interface ProfilePageProps {
  onBack?: () => void;
  onOpenReel?: (reelId: string) => void;
}

export function ProfilePage({ onBack, onOpenReel }: ProfilePageProps) {
  const { user, token, logout, setUserFromProfile } = useAuth();
  const [profileTab, setProfileTab] = useState<ProfileTab>('profil');
  const [reelsRefreshKey, setReelsRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState(() => profileToForm(user));

  useEffect(() => {
    if (user && !editing) setForm(profileToForm(user));
  }, [user, editing]);

  const startEditing = useCallback(() => {
    if (!user) return;
    setForm(profileToForm(user));
    setSavedMsg(null);
    setSaveError(null);
    setEditing(true);
  }, [user]);

  const saveProfile = useCallback(async () => {
    if (!user || !token) return;
    const name = form.username.trim();
    if (name.length < 2) {
      setSaveError('Le pseudo doit faire au moins 2 caractères');
      return;
    }
    setSaving(true);
    setSavedMsg(null);
    setSaveError(null);
    try {
      const currentPhotos = getProfilePhotos(user);
      const photosChanged = profilePhotosChanged(currentPhotos, form.profilePhotos);

      const body: Record<string, unknown> = {
        username: name,
        bio: form.bio,
        city: form.city,
        listeningRole: form.listeningRole,
        relationshipStatus: form.relationshipStatus || null,
        interests: form.interests,
        favoriteGenres: form.favoriteGenres,
        favoriteArtists: form.favoriteArtists,
      };

      if (photosChanged) {
        body.profilePhotos = await prepareProfilePhotosForSave(form.profilePhotos);
      }

      const payload = JSON.stringify(body);
      if (payload.length > MAX_PROFILE_PAYLOAD_CHARS) {
        throw new Error(
          'Profil trop volumineux (photos). Retirez une photo ou utilisez des images plus légères.'
        );
      }

      const { user: updated } = await api.updateProfile(token, body);
      setUserFromProfile(updated);
      setForm(profileToForm(updated));
      setEditing(false);
      setSavedMsg('Profil enregistré');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Impossible d\'enregistrer le profil';
      setSaveError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [user, token, form, setUserFromProfile]);

  if (!user || !token) return null;

  if (showSettings) {
    return (
      <SettingsPage onBack={() => setShowSettings(false)} />
    );
  }

  const memberDate = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '—';

  const displayPhotos = editing ? form.profilePhotos : getProfilePhotos(user);

  const addTag = (field: 'interests' | 'favoriteGenres' | 'favoriteArtists', value: string) => {
    const v = value.trim();
    if (!v || form[field].includes(v)) return;
    setForm((f) => ({ ...f, [field]: [...f[field], v] }));
  };

  const removeTag = (field: 'interests' | 'favoriteGenres' | 'favoriteArtists', tag: string) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((t) => t !== tag) }));
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0b0f]">
      <div className="relative shrink-0">
        <div className="h-36 bg-gradient-to-br from-purple-900/80 via-[#1a1035] to-pink-900/40" />
        <div className="absolute top-3 left-3 z-10">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur border border-white/20 text-white text-lg hover:bg-black/60"
              aria-label="Fermer le profil"
            >
              ←
            </button>
          )}
        </div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {savedMsg && (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">
              {savedMsg}
            </span>
          )}
          {!editing && <SettingsGearButton onClick={() => setShowSettings(true)} />}
          {!editing ? (
            <button
              type="button"
              onClick={startEditing}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 rounded-full text-xs font-bold text-white"
            >
              Modifier
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 bg-[#1a1a26]/90 border border-[#2d2d3d] rounded-full text-xs font-bold text-gray-300"
            >
              Annuler
            </button>
          )}
        </div>
        <div className="absolute -bottom-10 left-4 right-4">
          <h1 className="text-2xl font-extrabold text-white truncate">
            {editing ? form.username || user.username : user.username}
          </h1>
          <p className="text-sm text-purple-300">
            {ROLE_LABELS[editing ? form.listeningRole : (user.listeningRole ?? 'auditeur')]}
          </p>
          {(editing ? form.city : user.city) && (
            <p className="text-xs text-gray-400 mt-0.5">📍 {editing ? form.city : user.city}</p>
          )}
          {!editing && user.relationshipStatus && (
            <p className="text-xs text-pink-300/90 mt-0.5">
              {user.relationshipStatus === 'en_couple' ? '💑' : '✨'}{' '}
              {RELATIONSHIP_LABELS[user.relationshipStatus]}
            </p>
          )}
        </div>
      </div>

      <div className="pt-12 px-4 pb-8 space-y-5">
        {!editing && (
          <div className="flex gap-2 p-1 bg-[#12121a] border border-[#1e1e2f] rounded-xl">
            {(
              [
                ['profil', 'Profil'],
                ['enregistrer', 'Enregistrer'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileTab(id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                  profileTab === id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {profileTab === 'enregistrer' && !editing && token && (
          <ProfileReelRecorder
            token={token}
            defaultArtist={user.username}
            onSaved={() => {
              setReelsRefreshKey((k) => k + 1);
              setProfileTab('profil');
            }}
          />
        )}

        {(profileTab === 'profil' || editing) && (
          <>
        <ProfilePhotoGallery
          photos={displayPhotos}
          fallbackSeed={user.id}
          editing={editing}
          onChange={
            editing
              ? (profilePhotos) =>
                  setForm((f) => ({
                    ...f,
                    profilePhotos,
                    avatarUrl: profilePhotos[0] ?? '',
                  }))
              : undefined
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{user.stats?.salonsHosted ?? 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Salons</p>
          </div>
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-white">{user.stats?.livesHosted ?? 0}</p>
            <p className="text-[10px] text-gray-500 uppercase">Lives</p>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Membre depuis {memberDate} · Profil musical MeloSong
        </p>

        {(user.listeningRole === 'host' ||
          user.listeningRole === 'les_deux' ||
          (user.stats?.salonsHosted ?? 0) > 0) &&
          !editing && (
            <div className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3">
              <HostRatingBlock hostId={user.id} hostName={user.username} compact />
            </div>
          )}

        {!editing ? (
          <>
            {user.relationshipStatus && (
              <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">
                  {user.relationshipStatus === 'en_couple' ? '💑' : '✨'}
                </span>
                <div>
                  <h3 className="text-xs font-bold text-pink-300/90 uppercase tracking-wider">Situation</h3>
                  <p className="text-sm text-gray-300">{RELATIONSHIP_LABELS[user.relationshipStatus]}</p>
                </div>
              </section>
            )}

            <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Bio</h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {user.bio || <span className="text-gray-500 italic">Ajoutez une bio via Modifier</span>}
              </p>
            </section>

            {!editing && onOpenReel && profileTab === 'profil' && (
              <UserReelsSection
                userId={user.id}
                isOwner
                onOpenReel={onOpenReel}
                refreshKey={reelsRefreshKey}
              />
            )}

            <TagSection title="Centres d'intérêt" tags={user.interests ?? []} color="cyan" emptyHint />
            <TagSection title="Genres favoris" tags={user.favoriteGenres ?? []} color="purple" emptyHint />
            <TagSection title="Artistes" tags={user.favoriteArtists ?? []} color="pink" emptyHint />

            <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Comptes streaming (host)
              </h3>
              <p className="text-[10px] text-gray-500">
                Obligatoire pour créer ou animer un salon sur la plateforme choisie.
              </p>
              {(['spotify', 'youtube'] as const).map((p) => (
                <PlatformConnectCard
                  key={p}
                  token={token}
                  platform={p}
                  connectedPlatforms={user.connectedPlatforms}
                  onUserUpdated={(u) => {
                    setUserFromProfile(u);
                    setForm(profileToForm(u));
                  }}
                />
              ))}
            </section>

            <p className="text-xs text-gray-500 text-center px-2">
              Votre profil aide les autres à trouver des goûts musicaux communs — pas un profil de rencontre.
            </p>

            <button
              type="button"
              onClick={startEditing}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white shadow-lg shadow-purple-900/30"
            >
              Modifier mon profil
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-white">Édition du profil</p>

            <label className="block">
              <span className="text-xs text-gray-400">Pseudo</span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                maxLength={32}
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Bio</span>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={4}
                maxLength={500}
                placeholder="Parlez de votre rapport à la musique, vos sessions, ce que vous cherchez sur MeloSong..."
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              />
              <span className="text-[10px] text-gray-600">{form.bio.length}/500</span>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Ville (optionnel)</span>
              <CityAutocomplete
                value={form.city}
                onChange={(city) => setForm((f) => ({ ...f, city }))}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Rôle sur MeloSong</span>
              <select
                value={form.listeningRole}
                onChange={(e) =>
                  setForm((f) => ({ ...f, listeningRole: e.target.value as ListeningRole }))
                }
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              >
                <option value="auditeur">Auditeur</option>
                <option value="host">Host / DJ</option>
                <option value="les_deux">Auditeur & Host</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-400">Situation (optionnel)</span>
              <select
                value={form.relationshipStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    relationshipStatus: e.target.value as RelationshipStatus | '',
                  }))
                }
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              >
                <option value="">Ne pas afficher</option>
                <option value="celibataire">Célibataire</option>
                <option value="en_couple">En couple</option>
              </select>
              <p className="text-[10px] text-gray-600 mt-1">Information facultative sur votre profil musical</p>
            </label>

            <EditableTags
              label="Centres d'intérêt"
              tags={form.interests}
              input={form.newInterest}
              onInput={(v) => setForm((f) => ({ ...f, newInterest: v }))}
              onAdd={() => {
                addTag('interests', form.newInterest);
                setForm((f) => ({ ...f, newInterest: '' }));
              }}
              onRemove={(t) => removeTag('interests', t)}
              suggestions={SUGGESTED_INTERESTS}
            />
            <EditableTags
              label="Genres favoris"
              tags={form.favoriteGenres}
              input={form.newGenre}
              onInput={(v) => setForm((f) => ({ ...f, newGenre: v }))}
              onAdd={() => {
                addTag('favoriteGenres', form.newGenre);
                setForm((f) => ({ ...f, newGenre: '' }));
              }}
              onRemove={(t) => removeTag('favoriteGenres', t)}
            />
            <EditableTags
              label="Artistes favoris"
              tags={form.favoriteArtists}
              input={form.newArtist}
              onInput={(v) => setForm((f) => ({ ...f, newArtist: v }))}
              onAdd={() => {
                addTag('favoriteArtists', form.newArtist);
                setForm((f) => ({ ...f, newArtist: '' }));
              }}
              onRemove={(t) => removeTag('favoriteArtists', t)}
            />

            <div className="space-y-2">
              <span className="text-xs text-gray-400">Comptes streaming</span>
              {(['spotify', 'youtube'] as const).map((p) => (
                <PlatformConnectCard
                  key={p}
                  token={token}
                  platform={p}
                  connectedPlatforms={user.connectedPlatforms}
                  onUserUpdated={(u) => {
                    setUserFromProfile(u);
                    setForm(profileToForm(u));
                  }}
                />
              ))}
            </div>

            {saveError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                {saveError}
              </p>
            )}

            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white disabled:opacity-50 sticky bottom-2 z-10 shadow-lg"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        )}

          </>
        )}

        {!editing && profileTab === 'profil' && (
          <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
            <p className="text-xs text-gray-500">{user.email}</p>
            <SupportMeloSongTeaser onOpen={() => setShowSettings(true)} />
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-full py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-gray-300 font-semibold text-sm"
            >
              ⚙️ Paramètres
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full py-3 rounded-xl bg-[#1a1a26] border border-[#2d2d3d] text-red-400 font-semibold"
            >
              Déconnexion
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function TagSection({
  title,
  tags,
  color,
  emptyHint,
}: {
  title: string;
  tags: string[];
  color: 'cyan' | 'purple' | 'pink';
  emptyHint?: boolean;
}) {
  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    pink: 'bg-pink-500/10 text-pink-300 border-pink-500/30',
  };
  if (!tags.length && !emptyHint) return null;
  return (
    <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">
      <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">{title}</h3>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className={`px-3 py-1 rounded-full text-xs border ${colors[color]}`}>
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">Non renseigné</p>
      )}
    </section>
  );
}

function EditableTags({
  label,
  tags,
  input,
  onInput,
  onAdd,
  onRemove,
  suggestions,
}: {
  label: string;
  tags: string[];
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (t: string) => void;
  suggestions?: string[];
}) {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex flex-wrap gap-2 mt-2 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs flex items-center gap-1"
          >
            {t}
            <button type="button" onClick={() => onRemove(t)} className="text-purple-400 hover:text-white">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-2 text-white text-sm"
          placeholder="Ajouter..."
        />
        <button type="button" onClick={onAdd} className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm">
          +
        </button>
      </div>
      {suggestions && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions
            .filter((s) => !tags.includes(s))
            .slice(0, 5)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onInput(s)}
                className="text-[10px] text-gray-500 hover:text-purple-400"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
