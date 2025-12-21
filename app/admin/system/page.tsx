'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';

interface SystemStats {
  databaseSize: string;
  totalTables: number;
  totalRecords: number;
  oldestUser: string;
  newestUser: string;
}

export default function AdminSystem() {
  const router = useRouter();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'default';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch('/api/admin/system-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else if (response.status === 403) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function showConfirm(
    title: string,
    message: string,
    onConfirm: () => void,
    variant: 'danger' | 'default' = 'default'
  ) {
    setConfirmModal({ isOpen: true, title, message, onConfirm, variant });
  }

  async function resetAllDebt() {
    try {
      const response = await fetch('/api/admin/reset-debt', {
        method: 'POST',
      });

      if (response.ok) {
        showToast('All user debt reset to 0', 'success');
      } else {
        showToast('Failed to reset debt', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function cleanupOldChat() {
    try {
      const response = await fetch('/api/admin/cleanup-chat', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        showToast(`Cleaned up ${data.deletedCount} old messages`, 'success');
        fetchStats();
      } else {
        showToast('Failed to cleanup chat', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="bg-purple-900 border-b border-purple-800 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">System Management</h1>
          <div className="flex gap-2">
            <Link
              href="/admin/dashboard"
              className="text-purple-200 hover:text-purple-100 px-4 py-2.5 rounded-md hover:bg-purple-800 active:bg-purple-700 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              Dashboard
            </Link>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-purple-200 hover:text-purple-100 px-4 py-2.5 rounded-md hover:bg-purple-800 active:bg-purple-700 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Navigation */}
        <div className="mb-6 sm:mb-8">
          <nav className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 bg-purple-800 text-purple-200 rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className="px-4 py-2 bg-purple-800 text-purple-200 rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              Users
            </Link>
            <Link
              href="/admin/verification"
              className="px-4 py-2 bg-purple-800 text-purple-200 rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              Photo Verification
            </Link>
            <Link
              href="/admin/chat"
              className="px-4 py-2 bg-purple-800 text-purple-200 rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              Chat Moderation
            </Link>
            <Link
              href="/admin/system"
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
            >
              System
            </Link>
          </nav>
        </div>

        {/* System Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Database Size</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.databaseSize}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Total Tables</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.totalTables}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Total Records</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.totalRecords}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Oldest User</div>
              <div className="text-sm sm:text-base font-semibold text-purple-100">{stats.oldestUser}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Newest User</div>
              <div className="text-sm sm:text-base font-semibold text-purple-100">{stats.newestUser}</div>
            </div>
          </div>
        )}

        {/* System Actions */}
        <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-purple-100 mb-4 sm:mb-6">System Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <button
              onClick={() =>
                showConfirm(
                  'Reset All Debt',
                  'Are you sure you want to reset all user debt to 0? This action cannot be undone.',
                  resetAllDebt,
                  'danger'
                )
              }
              className="p-4 bg-purple-800/50 border border-purple-700 rounded-lg hover:bg-purple-800 transition-colors text-left"
            >
              <div className="text-base sm:text-lg font-semibold text-purple-100 mb-1">Reset All Debt</div>
              <div className="text-xs sm:text-sm text-purple-300">Set all user debt to 0</div>
            </button>
            <button
              onClick={() =>
                showConfirm(
                  'Cleanup Old Chat',
                  'Delete all chat messages older than 24 hours?',
                  cleanupOldChat,
                  'default'
                )
              }
              className="p-4 bg-purple-800/50 border border-purple-700 rounded-lg hover:bg-purple-800 transition-colors text-left"
            >
              <div className="text-base sm:text-lg font-semibold text-purple-100 mb-1">Cleanup Old Chat</div>
              <div className="text-xs sm:text-sm text-purple-300">Remove messages older than 24h</div>
            </button>
          </div>
        </div>
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} });
        }}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
        variant={confirmModal.variant}
      />
    </div>
  );
}

