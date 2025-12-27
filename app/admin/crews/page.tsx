'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';

interface Crew {
  id: number;
  name: string;
  leader_username: string;
  tag: string | null;
  tag_color: string;
  member_count: number;
  average_streak: number;
  average_trophies: number;
}

export default function AdminCrewsPage() {
  const router = useRouter();
  const [crews, setCrews] = useState<Crew[]>([]);
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

  const fetchCrews = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/crews');
      if (response.ok) {
        const data = await response.json();
        setCrews(data.crews || []);
      } else if (response.status === 403) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Error fetching crews:', err);
      showToast('Failed to load crews', 'error');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCrews();
  }, [fetchCrews]);

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

  async function handleDeleteCrew(crewId: number, crewName: string) {
    showConfirm(
      'Delete Crew',
      `Are you sure you want to delete crew "${crewName}"? This will remove all members from the crew.`,
      async () => {
        try {
          const response = await fetch('/api/admin/crews/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crewId }),
          });

          const data = await response.json();

          if (response.ok) {
            showToast('Crew deleted successfully', 'success');
            fetchCrews();
          } else {
            showToast(data.error || 'Failed to delete crew', 'error');
          }
        } catch (err) {
          showToast('An error occurred', 'error');
        }
      },
      'danger'
    );
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="flex items-center">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={180}
                height={52}
                priority
                unoptimized
                className="h-8 sm:h-10 w-auto object-contain"
              />
            </Link>
            <Link
              href="/dashboard"
              className="p-2 text-gray-400 hover:text-gray-100 transition-colors"
              aria-label="Dashboard"
              title="Dashboard"
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
              href="/admin/crews"
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
            >
              Crews
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
              href="/admin/feedback"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              Feedback
            </Link>
            <Link
              href="/admin/system"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              System
            </Link>
          </nav>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-4 sm:mb-6">Crew Management</h1>

          {crews.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No crews found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Tag</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Leader</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-300">Members</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-300">Avg Streak</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-300">Avg Dumbbells</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crews.map((crew) => (
                    <tr key={crew.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-medium text-gray-100">{crew.name}</span>
                      </td>
                      <td className="py-4 px-4">
                        {crew.tag ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold border-2"
                            style={{
                              backgroundColor: `${crew.tag_color}20`,
                              borderColor: crew.tag_color,
                              color: crew.tag_color,
                            }}
                          >
                            {crew.tag}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-300">@{crew.leader_username}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-gray-300">{crew.member_count}/30</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-primary-400 font-semibold">{crew.average_streak}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-yellow-400 font-semibold">{crew.average_trophies}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleDeleteCrew(crew.id, crew.name)}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

