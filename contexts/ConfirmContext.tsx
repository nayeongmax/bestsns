import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

export interface ConfirmOptions {
  title?: string;
  description: string;
  dangerLine?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface AlertOptions {
  title?: string;
  description: string;
  onClose?: () => void;
}

interface ModalState {
  open: boolean;
  type: 'confirm' | 'alert';
  title: string;
  description: string;
  dangerLine?: string;
  confirmLabel: string;
  cancelLabel: string | null;
  danger: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const defaultState: ModalState = {
  open: false,
  type: 'confirm',
  title: '',
  description: '',
  confirmLabel: '확인',
  cancelLabel: '취소',
  danger: false,
  onConfirm: () => {},
  onCancel: () => {},
};

type ConfirmContextValue = {
  showConfirm: (opts: ConfirmOptions) => void;
  showAlert: (opts: AlertOptions) => Promise<void>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(defaultState);

  const close = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  const showConfirm = useCallback((opts: ConfirmOptions) => {
    setModal({
      open: true,
      type: 'confirm',
      title: opts.title ?? '확인',
      description: opts.description,
      dangerLine: opts.dangerLine,
      confirmLabel: opts.confirmLabel ?? '확인',
      cancelLabel: opts.cancelLabel ?? '취소',
      danger: opts.danger ?? false,
      onConfirm: () => {
        opts.onConfirm();
        close();
      },
      onCancel: () => {
        opts.onCancel?.();
        close();
      },
    });
  }, [close]);

  const showAlert = useCallback((opts: AlertOptions): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        open: true,
        type: 'alert',
        title: opts.title ?? '알림',
        description: opts.description,
        confirmLabel: '확인',
        cancelLabel: null,
        danger: false,
        onConfirm: () => {
          opts.onClose?.();
          close();
          resolve();
        },
        onCancel: () => {
          close();
          resolve();
        },
      });
    });
  }, [close]);

  return (
    <ConfirmContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      <ConfirmModal
        open={modal.open}
        variant={modal.type}
        title={modal.title}
        description={modal.description}
        dangerLine={modal.dangerLine}
        confirmLabel={modal.confirmLabel}
        cancelLabel={modal.cancelLabel}
        danger={modal.danger}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
