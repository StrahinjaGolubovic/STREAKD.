'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastContainer, Toast, showToast } from '@/components/Toast';

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
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-2">Feedback</h1>
          <p className="text-gray-400 mb-6">
            We'd love to hear your thoughts! Share your feedback, suggestions, or report any issues.
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
      <ToastContainer toasts={toasts} setToasts={setToasts} />
    </div>
  );
}

