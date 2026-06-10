export function SearchInlineSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2 px-3">
      <span
        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-gray-600 border-t-green-400 animate-spin"
        aria-hidden
      />
      {label ? <span className="text-xs text-gray-500">{label}</span> : null}
    </div>
  );
}
