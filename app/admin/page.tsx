'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';

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

export default function AdminPanel() {
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

  useEffect(() => {
    fetchPendingUploads();
  }, []);

  async function fetchPendingUploads() {
    try {
      const response = await fetch('/api/admin/pending-uploads');
      if (response.ok) {
        const data = await response.json();
        setUploads(data.uploads || []);
      } else if (response.status === 403) {
        router.push('/dashboard');
      } else {
        console.error('Failed to fetch pending uploads');
      }
    } catch (err) {
      console.error('Error fetching pending uploads:', err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function showConfirm(title: string, message: string, onConfirm: () => void, variant: 'danger' | 'default' = 'default') {
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
      },
      status === 'rejected' ? 'danger' : 'default'
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
        showToast('Metadata extracted successfully', 'success');
      } else {
        showToast('Failed to extract metadata', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    } finally {
      setMetadataLoading(false);
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
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-400">Admin Panel - Photo Verification</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-300 hover:text-gray-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {uploads.map((upload) => (
              <div
                key={upload.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-100">
                        @{upload.username}
                      </h3>
                      <span className="px-2 py-1 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-xs rounded">
                        Pending
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Upload Date: {new Date(upload.upload_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400">
                      Submitted: {new Date(upload.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <img
                    src={getImageUrl(upload.photo_path) || ''}
                    alt={`Upload from ${upload.username}`}
                    className="w-full h-auto rounded-lg border border-gray-700 max-h-64 object-contain bg-gray-900"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => {
                      setSelectedUpload(upload);
                      setMetadata(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleExtractMetadata(upload.photo_path)}
                    disabled={metadataLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
                  >
                    {metadataLoading ? 'Extracting...' : 'Extract Metadata'}
                  </button>
                  <button
                    onClick={() => handleVerify(upload.id, 'approved')}
                    disabled={verifying === upload.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
                  >
                    {verifying === upload.id ? 'Verifying...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleVerify(upload.id, 'rejected')}
                    disabled={verifying === upload.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors text-sm sm:text-base"
                  >
                    {verifying === upload.id ? 'Verifying...' : 'Reject'}
                  </button>
                </div>

                {selectedUpload?.id === upload.id && (
                  <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-100 mb-2">Upload Details</h4>
                    <div className="text-xs sm:text-sm text-gray-300 space-y-1">
                      <p>Upload ID: {upload.id}</p>
                      <p>Challenge ID: {upload.challenge_id}</p>
                      <p>User ID: {upload.user_id}</p>
                      <p>Photo Path: {upload.photo_path}</p>
                    </div>
                  </div>
                )}

                {metadata && selectedUpload?.id === upload.id && (
                  <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-100 mb-2">Image Metadata</h4>
                    <pre className="text-xs text-gray-300 overflow-x-auto">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
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

