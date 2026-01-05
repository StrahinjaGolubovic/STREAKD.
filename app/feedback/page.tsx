'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';

function showToast(message: string, type: 'success' | 'error' | 'info', setToasts: React.Dispatch<React.SetStateAction<Toast[]>>) {
  const id = Date.now().toString();
  setToasts((prev) => [...prev, { id, message, type }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, 5000);
}

export default function FeedbackPage() {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) {
      showToast('Please enter your feedback', 'error', setToasts);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Feedback submitted successfully! Thank you!', 'success', setToasts);
        setFeedback('');
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        showToast(data.error || 'Failed to submit feedback', 'error', setToasts);
      }
    } catch (error) {
      showToast('An error occurred while submitting feedback', 'error', setToasts);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between min-h-[44px] sm:min-h-[48px]">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={1080}
                height={200}
                priority
                unoptimized
                className="h-9 sm:h-10 md:h-12 w-auto"
                style={{ objectFit: 'contain' }}
              />
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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-2">Feedback</h1>
          <p className="text-gray-400 mb-6">
            {`We'd love to hear your thoughts!`} Share your feedback, suggestions, or report any issues.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="feedback" className="block text-sm font-medium text-gray-300 mb-2">
                Your Feedback
              </label>
              <textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={8}
                maxLength={5000}
                className="w-full bg-gray-900 border border-gray-600 rounded-md px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                placeholder="Share your thoughts, suggestions, or report issues..."
                disabled={submitting}
              />
              <div className="mt-1 text-xs text-gray-500 text-right">
                {feedback.length}/5000 characters
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting || !feedback.trim()}
                className="px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

