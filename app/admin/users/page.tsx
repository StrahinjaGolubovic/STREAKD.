'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';

interface User {
  id: number;
  username: string;
  debt: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  profile_picture: string | null;
  total_uploads: number;
  approved_uploads: number;
}

export default function AdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'username' | 'debt' | 'streak' | 'created'>('username');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
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
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else if (response.status === 403) {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
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

  async function resetUserDebt(userId: number, username: string) {
    try {
      const response = await fetch('/api/admin/reset-user-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        showToast(`Debt reset for ${username}`, 'success');
        fetchUsers();
      } else {
        showToast('Failed to reset debt', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function deleteUser(userId: number, username: string) {
    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        showToast(`User ${username} deleted`, 'success');
        fetchUsers();
      } else {
        showToast('Failed to delete user', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  // Filter and sort users
  const filteredUsers = users
    .filter((user) => user.username.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortBy) {
        case 'username':
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
        case 'debt':
          aVal = a.debt;
          bVal = b.debt;
          break;
        case 'streak':
          aVal = a.current_streak;
          bVal = b.current_streak;
          break;
        case 'created':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        default:
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

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
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">User Management</h1>
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
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
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

        {/* Search and Sort */}
        <div className="bg-purple-900 border border-purple-800 rounded-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-black border border-purple-700 rounded-md px-4 py-2.5 text-base text-purple-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
            />
            <select
              value={sortBy}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'username' || value === 'debt' || value === 'streak' || value === 'created') {
                  setSortBy(value);
                }
              }}
              className="bg-black border border-purple-700 rounded-md px-4 py-2.5 text-base text-purple-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
            >
              <option value="username">Sort by Username</option>
              <option value="debt">Sort by Debt</option>
              <option value="streak">Sort by Streak</option>
              <option value="created">Sort by Created</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2.5 bg-purple-800 text-purple-200 rounded-md hover:bg-purple-700 transition-colors text-base min-h-[44px]"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-purple-900 border border-purple-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-purple-200">User</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-purple-200">Debt</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-purple-200">Streak</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-purple-200">Uploads</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-purple-200">Joined</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-purple-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-purple-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {user.profile_picture ? (
                          <img
                            src={getImageUrl(user.profile_picture) || ''}
                            alt={user.username}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-purple-700 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-800 border border-purple-700 flex items-center justify-center">
                            <span className="text-purple-300 text-xs sm:text-sm font-semibold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm sm:text-base font-medium text-purple-100">@{user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm sm:text-base font-semibold ${user.debt > 0 ? 'text-red-400' : 'text-purple-200'}`}>
                        {user.debt}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm sm:text-base">
                        <div className="text-primary-400 font-semibold">{user.current_streak} days</div>
                        <div className="text-xs text-purple-300">Best: {user.longest_streak}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm sm:text-base">
                        <div className="text-purple-200">{user.approved_uploads}</div>
                        <div className="text-xs text-purple-300">of {user.total_uploads}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs sm:text-sm text-purple-300">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() =>
                            showConfirm(
                              'Reset Debt',
                              `Reset debt for ${user.username} to 0?`,
                              () => resetUserDebt(user.id, user.username),
                              'default'
                            )
                          }
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors"
                        >
                          Reset Debt
                        </button>
                        <button
                          onClick={() =>
                            showConfirm(
                              'Delete User',
                              `Are you sure you want to delete ${user.username}? This action cannot be undone.`,
                              () => deleteUser(user.id, user.username),
                              'danger'
                            )
                          }
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-xs sm:text-sm hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 && (
            <div className="p-8 text-center text-purple-300">
              {searchTerm ? 'No users found matching your search' : 'No users found'}
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-purple-300">
          Showing {filteredUsers.length} of {users.length} users
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


