'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';

interface ChatMessage {
  id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: string;
  profile_picture: string | null;
}

export default function AdminChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/chat-messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else if (response.status === 403) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchMessages();
    // Refresh every 10 seconds
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

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

  async function deleteMessage(messageId: number) {
    try {
      const response = await fetch('/api/admin/delete-message', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });

      if (response.ok) {
        showToast('Message deleted', 'success');
        fetchMessages();
      } else {
        showToast('Failed to delete message', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function clearAllMessages() {
    try {
      const response = await fetch('/api/admin/clear-chat', {
        method: 'POST',
      });

      if (response.ok) {
        showToast('All messages cleared', 'success');
        fetchMessages();
      } else {
        showToast('Failed to clear messages', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  const formatTime = (dateString: string) => {
    if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      const [, timePart] = dateString.split(' ');
      const [hour, minute] = timePart.split(':');
      return `${hour}:${minute}`;
    }
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const filteredMessages = messages.filter(
    (msg) =>
      msg.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">Chat Moderation</h1>
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
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
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
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
            >
              System
            </Link>
          </nav>
        </div>

        {/* Search and Actions */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search messages or users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-4 py-2.5 text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
            />
            <button
              onClick={() =>
                showConfirm(
                  'Clear All Messages',
                  'Are you sure you want to delete all chat messages? This action cannot be undone.',
                  clearAllMessages,
                  'danger'
                )
              }
              className="px-4 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 active:bg-red-800 transition-colors text-base min-h-[44px] whitespace-nowrap"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Messages List */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 sm:p-6 max-h-[600px] overflow-y-auto">
            {filteredMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                {searchTerm ? 'No messages found matching your search' : 'No messages in the last 24 hours'}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 sm:p-4 flex gap-3 sm:gap-4"
                  >
                    <div className="flex-shrink-0">
                      {msg.profile_picture ? (
                        <Image
                          src={getImageUrl(msg.profile_picture) || ''}
                          alt={msg.username}
                          width={48}
                          height={48}
                          unoptimized
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-gray-600 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
                          <span className="text-gray-400 text-sm sm:text-base font-semibold">
                            {msg.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm sm:text-base font-semibold text-gray-100">@{msg.username}</span>
                        <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                      </div>
                      <p className="text-sm sm:text-base text-gray-200 whitespace-pre-wrap break-words">{msg.message}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() =>
                          showConfirm(
                            'Delete Message',
                            'Are you sure you want to delete this message?',
                            () => deleteMessage(msg.id),
                            'danger'
                          )
                        }
                        className="px-3 py-1.5 bg-red-600 text-white rounded text-xs sm:text-sm hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-400">
          Showing {filteredMessages.length} of {messages.length} messages (last 24 hours)
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

