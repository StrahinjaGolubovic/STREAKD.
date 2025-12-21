'use client';

import { useEffect } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

export function ToastItem({ toast, onRemove }: ToastProps) {
  useEffect(() => {
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const bgColor =
    toast.type === 'success'
      ? 'bg-green-900/90 border-green-700'
      : toast.type === 'error'
      ? 'bg-red-900/90 border-red-700'
      : 'bg-purple-900/90 border-purple-700';

  const textColor =
    toast.type === 'success'
      ? 'text-green-300'
      : toast.type === 'error'
      ? 'text-red-300'
      : 'text-purple-300';

  return (
    <div
      className={`${bgColor} border-2 ${textColor} px-4 py-3 rounded-lg shadow-2xl flex items-center justify-between gap-4 min-w-[300px] max-w-md animate-slide-in backdrop-blur-sm`}
      role="alert"
    >
      <p className="flex-1 text-sm font-semibold">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className={`${textColor} hover:opacity-70 transition-opacity text-xl font-bold leading-none w-6 h-6 flex items-center justify-center`}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

