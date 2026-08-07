import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LivePinnedAnnouncement } from '../types';

type LiveHostAnnouncementSettingsProps = {
  announcement?: LivePinnedAnnouncement;
  onPublish: (text: string) => void;
  onClear: () => void;
};

/** Config live : annonce épinglée en tête du chat, distincte des animations de dons. */
export function LiveHostAnnouncementSettings({
  announcement,
  onPublish,
  onClear,
}: LiveHostAnnouncementSettingsProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(announcement?.text ?? '');

  useEffect(() => setText(announcement?.text ?? ''), [announcement?.text]);

  const publish = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onPublish(trimmed);
  };

  return (
    <div className="flex flex-col gap-2 pt-2">
      <p className="text-[11px] text-gray-500 leading-relaxed px-0.5">
        {t('live.announcementHint')}
      </p>
      <textarea
        value={text}
        maxLength={200}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        className="w-full px-2.5 py-2 rounded-lg bg-[#131318] border border-[#232330] text-white text-sm focus:border-purple-500/50 outline-none touch-manipulation resize-none"
        placeholder={t('live.announcementPlaceholder')}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={publish}
          disabled={!text.trim()}
          className="flex-1 min-h-11 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition touch-manipulation"
        >
          {announcement ? t('live.announcementUpdate') : t('live.announcementPublish')}
        </button>
        {announcement ? (
          <button
            type="button"
            onClick={() => { setText(''); onClear(); }}
            className="flex-1 min-h-11 py-2 rounded-xl bg-[#1a1a26] border border-[#232330] text-gray-400 text-xs transition touch-manipulation"
          >
            {t('live.announcementClear')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
