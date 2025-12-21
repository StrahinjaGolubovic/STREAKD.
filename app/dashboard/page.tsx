'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';

interface DashboardData {
  challenge: {
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    completed_days: number;
  };
  progress: {
    totalDays: number;
    completedDays: number;
    days: Array<{
      date: string;
      uploaded: boolean;
      photo_path?: string;
      verification_status?: string;
    }>;
  };
  streak: {
    current_streak: number;
    longest_streak: number;
  };
  debt: number;
  username?: string;
  profilePicture?: string | null;
}

interface Friend {
  id: number;
  username: string;
  debt: number;
  current_streak: number;
  longest_streak: number;
  profile_picture: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [inviteInput, setInviteInput] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [profilePictureUploading, setProfilePictureUploading] = useState(false);
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
    fetchDashboard();
    fetchFriends();
    fetchInviteCode();
  }, []);

  async function fetchDashboard() {
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else if (response.status === 401) {
        router.push('/login');
      } else {
        setError('Failed to load dashboard');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        await fetchDashboard();
        e.target.value = ''; // Reset input
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      setError('An error occurred during upload');
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  async function fetchFriends() {
    setFriendsLoading(true);
    try {
      const response = await fetch('/api/friends/list');
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    } finally {
      setFriendsLoading(false);
    }
  }

  async function fetchInviteCode() {
    try {
      const response = await fetch('/api/friends/invite-code');
      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.code);
      }
    } catch (err) {
      console.error('Failed to fetch invite code:', err);
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

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    setInviteLoading(true);
    try {
      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteInput.trim().toUpperCase() }),
      });

      const result = await response.json();

      if (response.ok) {
        setInviteInput('');
        await fetchFriends();
        showToast('Friend added successfully!', 'success');
      } else {
        showToast(result.error || 'Failed to accept invite code', 'error');
      }
    } catch (err) {
      showToast('An error occurred while accepting the invite code', 'error');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopyInviteCode() {
    if (inviteCode) {
      await navigator.clipboard.writeText(inviteCode);
      showToast('Invite code copied to clipboard!', 'success');
    }
  }

  async function handleRemoveFriend(friendId: number) {
    showConfirm(
      'Remove Friend',
      'Are you sure you want to remove this friend?',
      async () => {
        try {
          const response = await fetch('/api/friends/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendId }),
          });

          if (response.ok) {
            await fetchFriends();
            showToast('Friend removed successfully', 'success');
          } else {
            showToast('Failed to remove friend', 'error');
          }
        } catch (err) {
          showToast('An error occurred while removing friend', 'error');
        }
      },
      'danger'
    );
  }

  async function handleProfilePictureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfilePictureUploading(true);
    try {
      const formData = new FormData();
      formData.append('picture', file);

      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        // Update state immediately with new profile picture
        if (result.profile_picture && data) {
          setData({ ...data, profilePicture: result.profile_picture });
        }
        // Refresh dashboard to get latest data
        await fetchDashboard();
        showToast('Profile picture updated successfully', 'success');
      } else {
        const result = await response.json();
        showToast(result.error || 'Failed to upload profile picture', 'error');
      }
    } catch (err) {
      showToast('An error occurred while uploading profile picture', 'error');
    } finally {
      setProfilePictureUploading(false);
      e.target.value = ''; // Reset input
    }
  }

  async function handleRemoveProfilePicture() {
    showConfirm(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      async () => {
        try {
          const response = await fetch('/api/profile/picture', {
            method: 'DELETE',
          });

          if (response.ok) {
            await fetchDashboard();
            showToast('Profile picture removed successfully', 'success');
          } else {
            showToast('Failed to remove profile picture', 'error');
          }
        } catch (err) {
          showToast('An error occurred while removing profile picture', 'error');
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

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400">{error || 'Failed to load dashboard'}</div>
      </div>
    );
  }

  const progressPercentage = (data.progress.completedDays / data.progress.totalDays) * 100;
  const daysRemaining = data.progress.totalDays - data.progress.completedDays;
  const needsMoreDays = Math.max(0, 5 - data.progress.completedDays);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-primary-400">Gymble</h1>
          <div className="flex items-center gap-3">
            {/* Profile Picture */}
            <div className="relative group">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  disabled={profilePictureUploading}
                  className="hidden"
                />
                <div className="relative">
                  {data?.profilePicture ? (
                    <img
                      key={`profile-img-${data.profilePicture}`}
                      src={data.profilePicture}
                      alt=""
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-600 object-cover hover:border-primary-400 transition-colors"
                      onError={(e) => {
                        // Hide image on error and show fallback
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.classList.remove('hidden');
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center hover:border-primary-400 transition-colors ${data?.profilePicture ? 'hidden' : ''}`}
                  >
                    <span className="text-gray-400 text-lg font-semibold">
                      {data?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  {profilePictureUploading && (
                    <div className="absolute inset-0 bg-gray-900/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-400"></div>
                    </div>
                  )}
                </div>
              </label>
              {data?.profilePicture && (
                <button
                  onClick={handleRemoveProfilePicture}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove profile picture"
                >
                  ×
                </button>
              )}
            </div>
            {data && (data.username === 'admin' || data.username === 'seuq') && (
              <button
                onClick={() => router.push('/admin')}
                className="text-primary-400 hover:text-primary-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Admin Panel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="text-gray-300 hover:text-gray-100 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6">
            <div className="text-xs sm:text-sm font-medium text-gray-400">Debt</div>
            <div className={`mt-2 text-2xl sm:text-3xl font-bold ${data.debt > 0 ? 'text-red-400' : 'text-gray-100'}`}>
              {data.debt}
            </div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6">
            <div className="text-xs sm:text-sm font-medium text-gray-400">Current Streak</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold text-primary-400">{data.streak.current_streak} days</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
            <div className="text-xs sm:text-sm font-medium text-gray-400">Longest Streak</div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold text-gray-100">{data.streak.longest_streak} days</div>
          </div>
        </div>

        {/* Weekly Challenge Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-100">Weekly Challenge</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {new Date(data.challenge.start_date).toLocaleDateString()} -{' '}
                {new Date(data.challenge.end_date).toLocaleDateString()}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xl sm:text-2xl font-bold text-primary-400">
                {data.progress.completedDays}/{data.progress.totalDays}
              </div>
              <div className="text-xs sm:text-sm text-gray-400">days completed</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  progressPercentage >= 71.4 ? 'bg-green-500' : 'bg-primary-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Status Message */}
          {data.progress.completedDays >= 5 ? (
            <div className="bg-green-900/30 border border-green-700 text-green-300 px-4 py-3 rounded-md mb-6">
              ✅ You're on track! Complete {daysRemaining} more day(s) to maintain your streak.
            </div>
          ) : (
            <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-3 rounded-md mb-6">
              ⚠️ You need to complete at least {needsMoreDays} more day(s) this week to avoid adding 200 to your debt.
            </div>
          )}

          {/* Upload Section */}
          <div className="border-t border-gray-700 pt-4 sm:pt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4">Upload Today's Photo</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="cursor-pointer bg-primary-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-md hover:bg-primary-700 text-center text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {uploading ? 'Uploading...' : 'Choose Photo'}
                </div>
              </label>
              {error && <div className="text-red-400 text-xs sm:text-sm">{error}</div>}
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-2">
              Upload one photo per day as proof of your gym visit
            </p>
          </div>
        </div>

        {/* Days Grid */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-4 sm:mb-6">This Week's Progress</h2>
          <div className="grid grid-cols-7 gap-2 sm:gap-3 md:gap-4 overflow-x-auto">
            {data.progress.days.map((day, index) => {
              const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
              const dayNumber = new Date(day.date).getDate();
              const isToday = day.date === new Date().toISOString().split('T')[0];
              const isPast = new Date(day.date) < new Date();

              return (
                <div
                  key={day.date}
                  className={`border-2 rounded-lg p-2 sm:p-3 md:p-4 text-center min-w-[60px] sm:min-w-0 ${
                    day.uploaded
                      ? 'border-green-500 bg-green-900/20'
                      : isToday
                      ? 'border-primary-500 bg-primary-900/20'
                      : isPast
                      ? 'border-red-700 bg-red-900/20'
                      : 'border-gray-700 bg-gray-700/50'
                  }`}
                >
                  <div className="text-xs sm:text-sm font-medium text-gray-400">{dayName}</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mt-1">{dayNumber}</div>
                  {day.uploaded ? (
                    <div className="mt-2">
                      <div className="text-green-400 text-xs font-medium">✓ Uploaded</div>
                      {day.verification_status === 'pending' && (
                        <div className="text-yellow-400 text-xs">⏳ Pending Review</div>
                      )}
                      {day.verification_status === 'rejected' && (
                        <div className="text-red-400 text-xs">✗ Rejected</div>
                      )}
                      {day.photo_path && (
                        <div className="mt-2 relative w-full aspect-square rounded overflow-hidden bg-gray-700">
                          <img
                            src={getImageUrl(day.photo_path) || ''}
                            alt={`Photo for ${day.date}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  ) : isPast ? (
                    <div className="mt-2 text-red-400 text-xs font-medium">✗ Missed</div>
                  ) : (
                    <div className="mt-2 text-gray-500 text-xs">Pending</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Friends Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-4 sm:mb-6">Friends</h2>

          {/* Invite Code Section */}
          <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-gray-700/50 rounded-lg">
            <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4">Your Invite Code</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-3 sm:px-4 py-2.5 sm:py-3 font-mono text-base sm:text-lg font-bold text-primary-400 break-all">
                {inviteCode || 'Loading...'}
              </div>
              <button
                onClick={handleCopyInviteCode}
                disabled={!inviteCode}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                Copy
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-2">
              Share this code with friends so they can add you!
            </p>
          </div>

          {/* Accept Invite Section */}
          <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-gray-700/50 rounded-lg">
            <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4">Add Friend by Invite Code</h3>
            <form onSubmit={handleAcceptInvite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                maxLength={8}
                className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
              />
              <button
                type="submit"
                disabled={!inviteInput.trim() || inviteLoading}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                {inviteLoading ? 'Adding...' : 'Add Friend'}
              </button>
            </form>
          </div>

          {/* Friends List */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 sm:mb-4">
              Your Friends ({friends.length})
            </h3>
            {friendsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto"></div>
              </div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm sm:text-base">No friends yet. Share your invite code to get started!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map((friend) => {
                  return (
                    <div
                      key={friend.id}
                      className="bg-gray-700/50 border border-gray-600 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {friend.profile_picture ? (
                              <img
                                src={getImageUrl(friend.profile_picture) || ''}
                                alt={friend.username}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-600 object-cover"
                                onError={(e) => {
                                  // Hide image and show fallback if it fails to load
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center">
                                <span className="text-gray-400 text-xs sm:text-sm font-semibold">
                                  {friend.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <h4 className="text-base sm:text-lg font-semibold text-gray-100 truncate">@{friend.username}</h4>
                          </div>
                          {friend.debt > 0 && (
                            <span className="px-2 py-1 bg-red-900/50 border border-red-700 text-red-300 text-xs rounded whitespace-nowrap">
                              {friend.debt} in debt
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                          <div>
                            <span className="text-gray-400">Current Streak: </span>
                            <span className="text-primary-400 font-semibold">
                              {friend.current_streak} days
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Longest Streak: </span>
                            <span className="text-gray-300 font-semibold">
                              {friend.longest_streak} days
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Debt: </span>
                            <span className={`font-semibold ${friend.debt > 0 ? 'text-red-400' : 'text-gray-300'}`}>
                              {friend.debt}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400">Member since: </span>
                            <span className="text-gray-300">
                              {new Date(friend.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="self-start sm:self-auto px-3 sm:px-4 py-2 bg-red-900/50 border border-red-700 text-red-300 rounded-md hover:bg-red-900/70 transition-colors text-xs sm:text-sm whitespace-nowrap"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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

