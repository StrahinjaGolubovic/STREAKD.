'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';
import { formatDateDisplay, formatDateTimeDisplay } from '@/lib/timezone';

interface PendingUpload {
  id: number;
  user_id: number;
  username: string;
  upload_date: string;
  photo_path: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  metadata: string | null;
  created_at: string;
  challenge_id: number;
}

export default function AdminVerification() {
  const router = useRouter();
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<PendingUpload | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
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

  const fetchPendingUploads = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/pending-uploads');
      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads || []);
      } else if (response.status === 403) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPendingUploads();
  }, [fetchPendingUploads]);

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

  async function handleVerify(uploadId: number, status: 'approved' | 'rejected') {
    showConfirm(
      `${status === 'approved' ? 'Approve' : 'Reject'} Upload`,
      `Are you sure you want to ${status} this upload?`,
      async () => {
        setVerifying(uploadId);
        try {
          const response = await fetch('/api/admin/verify-upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadId, status }),
          });

          if (response.ok) {
            await fetchPendingUploads();
            if (selectedUpload?.id === uploadId) {
              setSelectedUpload(null);
              setMetadata(null);
            }
            showToast(`Upload ${status} successfully`, 'success');
          } else {
            showToast('Failed to verify upload', 'error');
          }
        } catch (err) {
          showToast('An error occurred', 'error');
        } finally {
          setVerifying(null);
        }
      }
    );
  }

  async function handleExtractMetadata(photoPath: string) {
    setMetadataLoading(true);
    try {
      const response = await fetch('/api/admin/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath }),
      });

      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata);
      } else {
        setMetadata(null);
        showToast('Failed to extract metadata', 'error');
      }
    } catch (err) {
      setMetadata(null);
      showToast('An error occurred while extracting metadata', 'error');
    } finally {
      setMetadataLoading(false);
    }
  }

  async function handleShowDetails(upload: PendingUpload) {
    setSelectedUpload(upload);
    setMetadata(null);
    // Automatically fetch metadata when opening details
    await handleExtractMetadata(upload.photo_path);
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
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">Photo Verification</h1>
          <div className="flex gap-2">
            <Link
              href="/admin/dashboard"
              className="text-gray-200 hover:text-gray-100 px-4 py-2.5 rounded-md hover:bg-gray-700 active:bg-gray-600 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              Dashboard
            </Link>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-200 hover:text-gray-100 px-4 py-2.5 rounded-md hover:bg-gray-700 active:bg-gray-600 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px]"
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
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
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

        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-2">
            Pending Verifications ({uploads.length})
          </h2>
          <p className="text-sm text-gray-400">
            Review and verify user photo uploads. Check metadata for legitimacy.
          </p>
        </div>

        {uploads.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-400">No pending uploads to verify.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-3 sm:p-4 md:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-100 truncate">
                        @{upload.username}
                      </h3>
                      <span className="px-2 py-1 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-xs rounded whitespace-nowrap">
                        Pending
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Upload Date: {formatDateDisplay(upload.upload_date)}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Submitted: {formatDateTimeDisplay(upload.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mb-3 sm:mb-4">
                  <div className="relative w-full h-48 sm:h-64 rounded-lg border border-gray-700 bg-gray-900 overflow-hidden">
                    <Image
                      src={getImageUrl(upload.photo_path) || ''}
                      alt={`Upload from ${upload.username}`}
                      fill
                      unoptimized
                      className="object-contain"
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => handleShowDetails(upload)}
                    disabled={metadataLoading && selectedUpload?.id === upload.id}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 active:bg-gray-500 disabled:opacity-50 transition-colors text-xs sm:text-sm md:text-base touch-manipulation min-h-[44px]"
                  >
                    {metadataLoading && selectedUpload?.id === upload.id ? 'Loading...' : 'Details'}
                  </button>
                  <button
                    onClick={() => handleVerify(upload.id, 'approved')}
                    disabled={verifying === upload.id}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-green-600 text-white rounded-md hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors text-xs sm:text-sm md:text-base touch-manipulation min-h-[44px]"
                  >
                    {verifying === upload.id ? 'Verifying...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleVerify(upload.id, 'rejected')}
                    disabled={verifying === upload.id}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors text-xs sm:text-sm md:text-base touch-manipulation min-h-[44px]"
                  >
                    {verifying === upload.id ? 'Verifying...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Details Modal */}
        {selectedUpload && (
          <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedUpload(null)}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-100">Upload Details</h3>
                <button
                  onClick={() => setSelectedUpload(null)}
                  className="text-gray-400 hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400">User</p>
                  <p className="text-base text-gray-100">@{selectedUpload.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Upload Date</p>
                  <p className="text-base text-gray-100">{new Date(selectedUpload.upload_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Submitted</p>
                  <p className="text-base text-gray-100">{formatDateTimeDisplay(selectedUpload.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Photo Path</p>
                  <p className="text-base text-gray-100 break-all">{selectedUpload.photo_path}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Metadata</p>
                  {metadataLoading ? (
                    <div className="bg-gray-900 p-3 rounded text-xs text-gray-200 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-400"></div>
                      <span>Extracting metadata...</span>
                    </div>
                  ) : metadata ? (
                    <pre className="bg-gray-900 p-3 rounded text-xs text-gray-200 overflow-x-auto">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  ) : (
                    <div className="bg-gray-900 p-3 rounded text-xs text-gray-400">
                      No metadata available
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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

