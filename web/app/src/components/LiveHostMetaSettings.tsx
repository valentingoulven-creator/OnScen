import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type LiveMetaValue = {
  title: string;
  description?: string;
  isSensitive?: boolean;
  replayEnabled?: boolean;
};

type LiveHostMetaSettingsProps = {
  value: LiveMetaValue;
  onChange: (patch: Partial<LiveMetaValue>) => void;
};

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-[#1e1e2f] bg-[#12121a] p-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-11 h-6 rounded-full border transition-colors touch-manipulation ${
          checked ? 'bg-purple-600 border-purple-500' : 'bg-[#1e1e2f] border-[#2a2a3a]'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  );
}

/** Config live : titre/description modifiables en direct + toggles contenu sensible / replay. */
export function LiveHostMetaSettings({ value, onChange }: LiveHostMetaSettingsProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(value.title);
  const [description, setDescription] = useState(value.description ?? '');

  useEffect(() => setTitle(value.title), [value.title]);
  useEffect(() => setDescription(value.description ?? ''), [value.description]);

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== value.title) onChange({ title: trimmed });
    else setTitle(value.title);
  };

  const commitDescription = () => {
    const trimmed = description.trim();
    if (trimmed !== (value.description ?? '')) onChange({ description: trimmed });
  };

  return (
    <div className="flex flex-col gap-3 pt-2">
      <div className="space-y-1">
        <label htmlFor="live-config-title" className="text-[10px] font-medium text-gray-500 px-0.5">
          {t('live.metaSettingsTitle')}
        </label>
        <input
          id="live-config-title"
          type="text"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-white text-sm focus:border-purple-500/50 outline-none touch-manipulation"
          placeholder={t('live.metaSettingsTitlePlaceholder')}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="live-config-description" className="text-[10px] font-medium text-gray-500 px-0.5">
          {t('live.metaSettingsDescription')}
        </label>
        <textarea
          id="live-config-description"
          value={description}
          maxLength={500}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commitDescription}
          className="w-full px-2.5 py-2 rounded-lg bg-[#131318] border border-[#232330] text-white text-sm focus:border-purple-500/50 outline-none touch-manipulation resize-none"
          placeholder={t('live.metaSettingsDescriptionPlaceholder')}
        />
        <p className="text-[10px] text-gray-600 text-right px-0.5">{description.length}/500</p>
      </div>

      <ToggleRow
        title={t('live.metaSettingsSensitiveTitle')}
        hint={t('live.metaSettingsSensitiveHint')}
        checked={!!value.isSensitive}
        onChange={(v) => onChange({ isSensitive: v })}
      />

      <ToggleRow
        title={t('live.metaSettingsReplayTitle')}
        hint={t('live.metaSettingsReplayHint')}
        checked={value.replayEnabled !== false}
        onChange={(v) => onChange({ replayEnabled: v })}
      />
    </div>
  );
}
