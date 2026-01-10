'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';
import { formatDateDisplay, formatDateTimeDisplay } from '@/lib/timezone';

interface User {
  id: number;
  username: string;
  trophies: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string | null;
  created_at: string;
  profile_picture: string | null;
  total_uploads: number;
  approved_uploads: number;
  is_premium?: number;
}

export default function AdminUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'username' | 'trophies' | 'streak' | 'created' | 'lastOnline'>('username');
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
    onConfirm: () => { },
  });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{
    trophies: string;
    current_streak: string;
    longest_streak: string;
    is_premium: boolean;
  }>({
    trophies: '',
    current_streak: '',
    longest_streak: '',
    is_premium: false,
  });

  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
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
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  async function resetUserTrophies(userId: number, username: string) {
    try {
      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, trophies: 0 }),
      });

      if (response.ok) {
        showToast(`Dumbbells reset for ${username}`, 'success');
        fetchUsers();
      } else {
        showToast('Failed to reset dumbbells', 'error');
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

  function openEdit(user: User) {
    setEditUser(user);
    setEditForm({
      trophies: String(user.trophies ?? 0),
      current_streak: String(user.current_streak ?? 0),
      longest_streak: String(user.longest_streak ?? 0),
      is_premium: user.is_premium === 1,
    });
  }

  async function saveUserEdits() {
    if (!editUser) return;
    try {
      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editUser.id,
          trophies: editForm.trophies,
          current_streak: editForm.current_streak,
          longest_streak: editForm.longest_streak,
          is_premium: editForm.is_premium ? 1 : 0,
        }),
      });

      if (response.ok) {
        showToast(`Updated @${editUser.username}`, 'success');
        setEditUser(null);
        fetchUsers();
      } else {
        const data = await response.json().catch(() => ({}));
        showToast(data.error || 'Failed to update user', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  function openPasswordReset(user: User) {
    setPasswordUser(user);
    setNewPassword('');
    setGeneratedPassword(null);
  }

  async function resetPasswordSubmit() {
    if (!passwordUser) return;
    try {
      const response = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: passwordUser.id,
          newPassword: newPassword.trim().length > 0 ? newPassword.trim() : undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setGeneratedPassword(data.newPassword || null);
        showToast(`Password reset for @${passwordUser.username}`, 'success');
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to reset password', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function impersonateUser(userId: number, username: string) {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        // Session cookie is now the user's token, so jump to dashboard as that user.
        router.push('/dashboard');
      } else {
        const data = await response.json().catch(() => ({}));
        showToast(data.error || 'Failed to login as user', 'error');
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
        case 'trophies':
          aVal = a.trophies;
          bVal = b.trophies;
          break;
        case 'streak':
          aVal = a.current_streak;
          bVal = b.current_streak;
          break;
        case 'created':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'lastOnline':
          aVal = a.last_activity_date ? new Date(a.last_activity_date).getTime() : 0;
          bVal = b.last_activity_date ? new Date(b.last_activity_date).getTime() : 0;
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">User Management</h1>
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
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base"
            >
              Users
            </Link>
            <Link
              href="/admin/crews"
              className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
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

        {/* Search and Sort */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-4 py-2.5 text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
            />
            <select
              value={sortBy}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'username' || value === 'trophies' || value === 'streak' || value === 'created' || value === 'lastOnline') {
                  setSortBy(value);
                }
              }}
              className="bg-gray-900 border border-gray-600 rounded-md px-4 py-2.5 text-base text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
            >
              <option value="username">Sort by Username</option>
              <option value="trophies">Sort by Dumbbells</option>
              <option value="streak">Sort by Streak</option>
              <option value="created">Sort by Created</option>
              <option value="lastOnline">Sort by Last Online</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-4 py-2.5 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-base min-h-[44px]"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">User</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">Dumbbells</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">Streak</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">Uploads</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">Joined</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">Status</th>
                  <th className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {user.profile_picture ? (
                          <Image
                            src={getImageUrl(user.profile_picture) || ''}
                            alt={user.username}
                            width={40}
                            height={40}
                            unoptimized
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-600 object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
                            <span className="text-gray-300 text-xs sm:text-sm font-semibold">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm sm:text-base font-medium text-gray-100">@{user.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm sm:text-base font-semibold text-yellow-400">
                        <span className="flex items-center gap-1">
                          <Image
                            src="/streakd_dumbbells.png"
                            alt="Dumbbells"
                            width={35}
                            height={20}
                            className="h-5 w-auto"
                            unoptimized
                          />
                          {user.trophies.toLocaleString()}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm sm:text-base">
                        <div className="text-primary-400 font-semibold">{user.current_streak} days</div>
                        <div className="text-xs text-gray-300">Best: {user.longest_streak}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm sm:text-base">
                        <div className="text-gray-200">{user.approved_uploads}</div>
                        <div className="text-xs text-gray-300">of {user.total_uploads}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs sm:text-sm text-gray-300">
                        {formatDateDisplay(user.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        if (!user.last_activity_date) {
                          return <span className="text-xs sm:text-sm text-gray-500">Offline</span>;
                        }

                        // Check if user was active in last 5 minutes
                        const lastActivity = new Date(user.last_activity_date).getTime();
                        const now = Date.now();
                        const fiveMinutes = 5 * 60 * 1000;
                        const isOnline = (now - lastActivity) < fiveMinutes;

                        return (
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                            <span className={`text-xs sm:text-sm font-medium ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded text-xs sm:text-sm hover:bg-gray-500 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            showConfirm(
                              'Reset Dumbbells',
                              `Reset dumbbells for ${user.username} to 0?`,
                              () => resetUserTrophies(user.id, user.username),
                              'default'
                            )
                          }
                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors"
                        >
                          Reset Dumbbells
                        </button>
                        <button
                          onClick={() => openPasswordReset(user)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs sm:text-sm hover:bg-indigo-700 transition-colors"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() =>
                            showConfirm(
                              'Login as User',
                              `This will switch your session to @${user.username}. You can return to admin later.`,
                              () => impersonateUser(user.id, user.username),
                              'default'
                            )
                          }
                          className="px-3 py-1.5 bg-green-600 text-white rounded text-xs sm:text-sm hover:bg-green-700 transition-colors"
                        >
                          Login As
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
            <div className="p-8 text-center text-gray-300">
              {searchTerm ? 'No users found matching your search' : 'No users found'}
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-300">
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
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => { } });
        }}
        onCancel={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => { } })}
        variant={confirmModal.variant}
      />

      {/* Edit User Modal */}
      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setEditUser(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Edit @{editUser.username}</h3>
            <p className="text-sm text-gray-300 mb-5">Set values manually. Streak baseline is set automatically.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm text-gray-200">
                Dumbbells
                <input
                  type="number"
                  min={0}
                  value={editForm.trophies}
                  onChange={(e) => setEditForm((p) => ({ ...p, trophies: e.target.value }))}
                  className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>

              <label className="text-sm text-gray-200">
                Current streak
                <input
                  type="number"
                  min={0}
                  value={editForm.current_streak}
                  onChange={(e) => setEditForm((p) => ({ ...p, current_streak: e.target.value }))}
                  className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>

              <label className="text-sm text-gray-200">
                Longest streak
                <input
                  type="number"
                  min={0}
                  value={editForm.longest_streak}
                  onChange={(e) => setEditForm((p) => ({ ...p, longest_streak: e.target.value }))}
                  className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </label>
            </div>

            {/* Premium Checkbox */}
            <div className="mt-4 pt-4 border-t border-gray-700">
              <label className="flex items-center gap-3 text-sm text-gray-200 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={editForm.is_premium}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_premium: e.target.checked }))}
                  className="w-5 h-5 bg-gray-900 border-2 border-gray-600 rounded text-purple-600 focus:ring-purple-500 focus:ring-2 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-br from-primary-900/60 to-primary-800/60 border border-primary-500/70 rounded-md shadow-md"
                    style={{
                      boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    <svg className="w-3.5 h-3.5 text-primary-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-[10px] font-bold text-primary-200 tracking-wider uppercase" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      PREMIUM
                    </span>
                  </div>
                  <span className="text-gray-300 group-hover:text-gray-100 transition-colors">
                    5 rest days, 1.5x coins
                  </span>
                </div>
              </label>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setEditUser(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveUserEdits}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPasswordUser(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-100 mb-1">Reset password for @{passwordUser.username}</h3>
            <p className="text-sm text-gray-300 mb-5">
              You can’t view existing passwords. This will set a new password (leave blank to generate a temporary one).
            </p>

            <label className="text-sm text-gray-200 block mb-3">
              New password (optional)
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </label>

            {generatedPassword && (
              <div className="mb-4 p-3 bg-gray-900 border border-gray-700 rounded-md">
                <div className="text-xs text-gray-300 mb-1">New password</div>
                <div className="flex items-center gap-2">
                  <code className="text-sm text-green-300 break-all flex-1">{generatedPassword}</code>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(generatedPassword);
                        showToast('Copied password', 'success');
                      } catch {
                        showToast('Copy failed', 'error');
                      }
                    }}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setPasswordUser(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md transition-colors"
              >
                Close
              </button>
              <button
                onClick={resetPasswordSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-medium"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


