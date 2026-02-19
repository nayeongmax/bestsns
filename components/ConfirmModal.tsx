import React from 'react';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  /** 강조 문구 (빨간색, 예: "삭제 후에는 복구가 불가능합니다.") */
  dangerLine?: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  /** true면 확인 버튼을 빨간색(위험) 스타일로 */
  danger?: boolean;
  /** 'alert'면 취소 버튼 숨김 (알림 전용) */
  variant?: 'confirm' | 'alert';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  description,
  dangerLine,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  danger = true,
  variant = 'confirm',
}) => {
  if (!open) return null;

  const isAlert = variant === 'alert';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && (isAlert ? onConfirm() : onCancel())}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-10 text-center animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center ring-4 ${isAlert ? 'bg-blue-50 ring-blue-100/80' : 'bg-amber-50 ring-amber-100/80'}`}>
          <span className="text-3xl" aria-hidden>{isAlert ? 'ℹ️' : '⚠️'}</span>
        </div>
        <h3
          id="confirm-modal-title"
          className={`text-xl font-black text-gray-900 uppercase tracking-tight pb-1 inline-block mb-4 ${isAlert ? 'border-b-2 border-blue-500' : 'border-b-2 border-red-500'}`}
        >
          {title}
        </h3>
        <p className="text-gray-700 font-bold text-[15px] leading-relaxed mb-1 whitespace-pre-line">
          {description}
        </p>
        {dangerLine && (
          <p className="text-red-600 font-bold text-sm mb-8">
            {dangerLine}
          </p>
        )}
        {!dangerLine && <div className="mb-8" />}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all ${
              isAlert ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200' : danger
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
            }`}
          >
            {confirmLabel}
          </button>
          {!isAlert && cancelLabel != null && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all italic"
            >
              {cancelLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
