export function TabLoading() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-0" role="status" aria-label="Chargement">
      <div className="w-7 h-7 border-2 border-purple-500/25 border-t-purple-400 rounded-full animate-spin" />
    </div>
  );
}
