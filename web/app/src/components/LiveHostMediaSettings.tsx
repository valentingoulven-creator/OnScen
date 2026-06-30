import { useTranslation } from 'react-i18next';
import {
  LIVE_VIDEO_RESOLUTION_OPTIONS,
  type LiveVideoResolutionPreset,
} from '../lib/liveVideoResolution';
import {
  LIVE_VIDEO_ASPECT_RATIO_OPTIONS,
  type LiveVideoAspectRatioPreset,
} from '../lib/liveVideoAspectRatio';
import {
  LIVE_VIDEO_DELAY_PRESETS,
  type LiveVideoDelayPreset,
} from '../lib/liveVideoDelay';
import {
  LIVE_CAMERA_CAM_SWITCHING,
  LIVE_CAMERA_MIC_SWITCHING,
} from '../lib/liveCameraMessages';

export type LiveMediaDeviceOption = { deviceId: string; label: string };

export type LiveHostMediaSettingsProps = {
  videoDevices: LiveMediaDeviceOption[];
  audioDevices: LiveMediaDeviceOption[];
  videoDeviceId: string;
  audioDeviceId: string;
  videoResolution: LiveVideoResolutionPreset;
  videoAspectRatio: LiveVideoAspectRatioPreset;
  videoDelaySeconds: number;
  cameraMode?: 'camera' | 'file' | null;
  cameraActive?: boolean;
  camSwitching?: boolean;
  micSwitching?: boolean;
  cameraToggling?: boolean;
  onCameraChange: (deviceId: string) => void;
  onMicChange: (deviceId: string) => void;
  onResolutionChange: (preset: LiveVideoResolutionPreset) => void;
  onAspectRatioChange: (preset: LiveVideoAspectRatioPreset) => void;
  onVideoDelayChange: (seconds: LiveVideoDelayPreset) => void;
  onRefreshDevices?: () => void;
};

export function LiveHostMediaSettings({
  videoDevices,
  audioDevices,
  videoDeviceId,
  audioDeviceId,
  videoResolution,
  videoAspectRatio,
  videoDelaySeconds,
  cameraMode,
  cameraActive = false,
  camSwitching = false,
  micSwitching = false,
  cameraToggling = false,
  onCameraChange,
  onMicChange,
  onResolutionChange,
  onAspectRatioChange,
  onVideoDelayChange,
  onRefreshDevices,
}: LiveHostMediaSettingsProps) {
  const { t } = useTranslation();
  const inputsDisabled =
    cameraMode === 'file' || camSwitching || micSwitching || cameraToggling;

  return (
    <div className="space-y-3 pb-4 border-b border-[#1e1e2f]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {t('live.mediaSettingsTitle')}
        </p>
        {onRefreshDevices ? (
          <button
            type="button"
            onClick={onRefreshDevices}
            className="min-h-11 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-950/40 transition touch-manipulation"
          >
            {t('live.mediaSettingsRefresh')}
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-gray-500 leading-snug">{t('live.mediaSettingsHint')}</p>

      {cameraMode === 'file' ? (
        <p className="text-[11px] text-amber-400/90 leading-snug">{t('live.mediaSettingsFileMode')}</p>
      ) : null}

      {videoDevices.length > 0 ? (
        <div className="space-y-1">
          <label htmlFor="live-config-cam" className="text-[10px] font-medium text-gray-500 px-0.5">
            {t('live.mediaSettingsCamera')}
          </label>
          <select
            id="live-config-cam"
            value={videoDeviceId || videoDevices[0]?.deviceId || ''}
            disabled={inputsDisabled}
            onChange={(e) => onCameraChange(e.target.value)}
            className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 disabled:opacity-50 truncate touch-manipulation"
          >
            {videoDevices.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">{t('live.mediaSettingsNoCamera')}</p>
      )}

      {audioDevices.length > 0 ? (
        <div className="space-y-1">
          <label htmlFor="live-config-mic" className="text-[10px] font-medium text-gray-500 px-0.5">
            {t('live.mediaSettingsMicrophone')}
          </label>
          <select
            id="live-config-mic"
            value={audioDeviceId || audioDevices[0]?.deviceId || ''}
            disabled={inputsDisabled}
            onChange={(e) => onMicChange(e.target.value)}
            className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 disabled:opacity-50 truncate touch-manipulation"
          >
            {audioDevices.map((m) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">{t('live.mediaSettingsNoMic')}</p>
      )}

      <div className="space-y-1">
        <label htmlFor="live-config-resolution" className="text-[10px] font-medium text-gray-500 px-0.5">
          {t('live.mediaSettingsResolution')}
        </label>
        <select
          id="live-config-resolution"
          value={videoResolution}
          disabled={inputsDisabled}
          onChange={(e) => onResolutionChange(e.target.value as LiveVideoResolutionPreset)}
          className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 disabled:opacity-50 touch-manipulation"
        >
          {LIVE_VIDEO_RESOLUTION_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {t(`live.mediaResolution.${opt.id}`, { width: opt.width, height: opt.height })}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-600 leading-snug px-0.5">
          {t('live.mediaSettingsResolutionHint')}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="live-config-aspect" className="text-[10px] font-medium text-gray-500 px-0.5">
          {t('live.mediaSettingsAspectRatio')}
        </label>
        <select
          id="live-config-aspect"
          value={videoAspectRatio}
          disabled={inputsDisabled}
          onChange={(e) => onAspectRatioChange(e.target.value as LiveVideoAspectRatioPreset)}
          className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 disabled:opacity-50 touch-manipulation"
        >
          {LIVE_VIDEO_ASPECT_RATIO_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {t(`live.mediaAspectRatio.${opt.id}`, {
                width: opt.widthRatio,
                height: opt.heightRatio,
              })}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-600 leading-snug px-0.5">
          {t('live.mediaSettingsAspectRatioHint')}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="live-config-delay" className="text-[10px] font-medium text-gray-500 px-0.5">
          {t('live.mediaSettingsVideoDelay')}
        </label>
        <select
          id="live-config-delay"
          value={videoDelaySeconds}
          onChange={(e) => onVideoDelayChange(Number(e.target.value) as LiveVideoDelayPreset)}
          className="w-full px-2.5 py-2 min-h-11 rounded-lg bg-[#131318] border border-[#232330] text-gray-300 text-[11px] hover:border-white/15 touch-manipulation"
        >
          {LIVE_VIDEO_DELAY_PRESETS.map((sec) => (
            <option key={sec} value={sec}>
              {sec === 0
                ? t('live.mediaVideoDelay.none')
                : t('live.mediaVideoDelay.seconds', { count: sec })}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-gray-600 leading-snug px-0.5">
          {t('live.mediaSettingsVideoDelayHint')}
        </p>
      </div>

      {(camSwitching || micSwitching) && (
        <p className="text-[10px] text-gray-500 px-0.5">
          {camSwitching ? LIVE_CAMERA_CAM_SWITCHING : LIVE_CAMERA_MIC_SWITCHING}
        </p>
      )}
      {!cameraActive && cameraMode !== 'file' && (
        <p className="text-[10px] text-gray-500 px-0.5">{t('live.mediaSettingsApplyOnCameraOn')}</p>
      )}
    </div>
  );
}
