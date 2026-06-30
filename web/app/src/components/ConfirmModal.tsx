import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  open: boolean;  title: string;
  description?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  /** Une seule action « OK » (pas de bouton Annuler). */
  alertOnly?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  cancelLabel = 'Annuler',
  confirmLabel = 'Supprimer',
  destructive = true,
  loading = false,
  loadingLabel,
  error,
  alertOnly = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  const titleId = 'confirm-modal-title';

  const modal = (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <p id={titleId} className="text-lg font-bold text-white">
            {title}
          </p>
          {description ? (
            <p className="mt-2 text-sm text-gray-400">{description}</p>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className={`flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50 ${alertOnly ? '' : ''}`}>
          {!alertOnly ? (
            <button
              type="button"
              disabled={loading}
              onClick={onCancel}
              className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={alertOnly ? onCancel : onConfirm}
            className={`${alertOnly ? 'w-full' : 'flex-1'} py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 ${
              destructive && !alertOnly
                ? 'bg-red-600/90 hover:bg-red-500'
                : 'bg-purple-600/90 hover:bg-purple-500'
            }`}
          >
            {loading ? (loadingLabel ?? '…') : alertOnly ? (confirmLabel || 'OK') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
