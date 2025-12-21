'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalUploads: number;
  pendingVerifications: number;
  totalDebt: number;
  averageStreak: number;
  totalMessages: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const response = await fetch('/api/admin/stats');
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
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="text-purple-200 hover:text-purple-100 px-4 py-2.5 rounded-md hover:bg-purple-800 active:bg-purple-700 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              Back to Dashboard
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
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
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
              className="px-4 py-2 bg-purple-800 text-purple-200 rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base"
            >
              System
            </Link>
          </nav>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8">
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Total Users</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.totalUsers}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Active Users</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-400">{stats.activeUsers}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Pending Verifications</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400">{stats.pendingVerifications}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Total Uploads</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.totalUploads}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Total Debt</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-red-400">{stats.totalDebt}</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Avg. Streak</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.averageStreak.toFixed(1)} days</div>
            </div>
            <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
              <div className="text-xs sm:text-sm font-medium text-purple-300 mb-1">Chat Messages (24h)</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-100">{stats.totalMessages}</div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-purple-100 mb-4 sm:mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link
              href="/admin/verification"
              className="p-4 bg-purple-800/50 border border-gray-600 rounded-lg hover:bg-purple-800 transition-colors"
            >
              <div className="text-base sm:text-lg font-semibold text-purple-100 mb-1">Review Photos</div>
              <div className="text-xs sm:text-sm text-purple-300">Verify pending uploads</div>
            </Link>
            <Link
              href="/admin/users"
              className="p-4 bg-purple-800/50 border border-gray-600 rounded-lg hover:bg-purple-800 transition-colors"
            >
              <div className="text-base sm:text-lg font-semibold text-purple-100 mb-1">Manage Users</div>
              <div className="text-xs sm:text-sm text-purple-300">View and manage all users</div>
            </Link>
            <Link
              href="/admin/chat"
              className="p-4 bg-purple-800/50 border border-gray-600 rounded-lg hover:bg-purple-800 transition-colors"
            >
              <div className="text-base sm:text-lg font-semibold text-purple-100 mb-1">Moderate Chat</div>
              <div className="text-xs sm:text-sm text-purple-300">View and manage chat messages</div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

