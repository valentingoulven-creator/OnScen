/** Attribution requise par les Spotify Branding Guidelines — libellé officiel en anglais. */
export function PoweredBySpotify({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-[10px] text-[#1DB954]/70'}>
      <a
        href="https://www.spotify.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1DB954]/50 rounded"
      >
        Powered by Spotify
      </a>
    </p>
  );
}
