import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar Exclusão',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const buttonColors = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex flex-col items-center text-center py-2">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
            variant === 'danger'
              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              : variant === 'warning'
              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
              : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
          }`}
        >
          <AlertTriangle className="w-7 h-7" />
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          {message}
        </p>

        <div className="flex items-center gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-sm"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium shadow-md transition-all text-sm flex items-center justify-center gap-2 ${buttonColors[variant]} ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
