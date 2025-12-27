'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const fetchStats = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">System Management</h1>
          <div className="flex gap-2">
            <Link
              href="/admin/dashboard"
              className="text-gray-200 hover:text-gray-100 px-4 py-2.5 rounded-md hover:bg-gray-700 active:bg-gray-600 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="p-2 text-gray-400 hover:text-gray-100 transition-colors"
              aria-label="Back to Dashboard"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Navigation */}
        <div className="mb-6 sm:mb-8">
          <nav className="flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/users"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Users
            </Link>
            <Link
              href="/admin/verification"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Photo Verification
            </Link>
            <Link
              href="/admin/chat"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Chat Moderation
            </Link>
            <Link
              href="/admin/crews"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Crews
            </Link>
            <Link
              href="/admin/feedback"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Feedback
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
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Database Size</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100">{stats.databaseSize}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Total Tables</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100">{stats.totalTables}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Total Records</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100">{stats.totalRecords}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Oldest User</div>
              <div className="text-sm sm:text-base font-semibold text-gray-100">{stats.oldestUser}</div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Newest User</div>
              <div className="text-sm sm:text-base font-semibold text-gray-100">{stats.newestUser}</div>
            </div>
          </div>
        )}

        {/* System Actions */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mb-4 sm:mb-6">System Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <button
              onClick={() =>
                showConfirm(
                  'Cleanup Old Chat',
                  'Delete all chat messages older than 24 hours?',
                  cleanupOldChat,
                  'default'
                )
              }
              className="p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors text-left"
            >
              <div className="text-base sm:text-lg font-semibold text-gray-100 mb-1">Cleanup Old Chat</div>
              <div className="text-xs sm:text-sm text-gray-400">Remove messages older than 24h</div>
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

