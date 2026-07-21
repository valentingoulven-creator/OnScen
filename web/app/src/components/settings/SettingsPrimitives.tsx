export function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/60 overflow-hidden divide-y divide-[#1e1e2f]/70">
      {children}
    </div>
  );
}

export function SettingsSubGroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-3 pb-1 text-[9px] font-semibold text-gray-600 uppercase tracking-wide first:pt-1">
      {children}
    </p>
  );
}

export function SettingsInfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 mb-1 px-3 py-2.5 rounded-xl bg-[#12121a]/40 border border-[#1e1e2f]/80 text-[11px] text-gray-500 leading-relaxed">
      {children}
    </p>
  );
}

export function SettingsRow({
  label,
  hint,
  onClick,
  children,
  destructive,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  destructive?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 p-4 min-h-[44px] text-left ${
        onClick
          ? destructive
            ? 'hover:bg-red-500/5 active:bg-red-500/10'
            : 'hover:bg-[#1a1a26] active:bg-[#1a1a26]'
          : ''
      }`}
    >
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${destructive ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children ?? (onClick && (
        <span className={`shrink-0 ${destructive ? 'text-red-400/70' : 'text-gray-500'}`}>›</span>
      ))}
    </Tag>
  );
}
