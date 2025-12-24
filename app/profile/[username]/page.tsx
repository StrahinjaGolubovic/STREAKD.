'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { getImageUrl } from '@/lib/image-utils';
import { formatDateDisplay } from '@/lib/timezone';
import { getTrophyRank, getRankColorStyle, getRankGradient, getRankBorderStyle } from '@/lib/ranks';

interface ProfileData {
  user: {
    id: number;
    username: string;
    trophies: number;
    profile_picture: string | null;
    created_at: string;
  };
  streak: {
    current_streak: number;
    longest_streak: number;
  };
  stats: {
    total_uploads: number;
    approved_uploads: number;
    rejected_uploads: number;
    pending_uploads: number;
  };
  recent_uploads: Array<{
    id: number;
    upload_date: string;
    photo_path: string;
    verification_status: string;
    created_at: string;
  }>;
  is_own_profile: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [updating, setUpdating] = useState(false);
  const [profilePicBroken, setProfilePicBroken] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const response = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
        setNewUsername(data.user.username);
      } else if (response.status === 404) {
        setError('User not found');
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateUsername() {
    if (!newUsername.trim() || newUsername.trim() === profileData?.user.username) {
      setEditingUsername(false);
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim() }),
      });

      const result = await response.json();

      if (response.ok) {
        showToast('Username updated successfully!', 'success');
        setEditingUsername(false);
        // Refresh profile data
        await fetchProfile();
        // Update URL if it's the current user's profile
        if (profileData?.is_own_profile) {
          router.push(`/profile/${encodeURIComponent(newUsername.trim())}`);
        }
      } else {
        showToast(result.error || 'Failed to update username', 'error');
      }
    } catch (err) {
      showToast('An error occurred while updating username', 'error');
    } finally {
      setUpdating(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Failed to load profile'}</p>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { user, streak, stats, recent_uploads, is_own_profile } = profileData;

  return (
    <div className="bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/streakd_logo.png"
              alt="STREAKD."
              width={140}
              height={36}
              priority
              unoptimized
              className="h-8 sm:h-9 md:h-10 w-auto"
            />
          </Link>
          <Link
            href="/dashboard"
            className="text-primary-400 hover:text-primary-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        {/* Profile Header */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Profile Picture */}
            <div className="relative">
              {user.profile_picture && !profilePicBroken ? (
                <Image
                  src={getImageUrl(user.profile_picture) || ''}
                  alt={user.username}
                  width={120}
                  height={120}
                  unoptimized
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-gray-700 object-cover"
                  onError={() => setProfilePicBroken(true)}
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gray-700 border-4 border-gray-600 flex items-center justify-center">
                  <span className="text-gray-400 text-4xl sm:text-5xl font-bold">
                    {user.username[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                {editingUsername ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      maxLength={20}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateUsername();
                        if (e.key === 'Escape') {
                          setEditingUsername(false);
                          setNewUsername(user.username);
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateUsername}
                        disabled={updating}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                      >
                        {updating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingUsername(false);
                          setNewUsername(user.username);
                        }}
                        className="px-4 py-2 bg-gray-600 text-gray-100 rounded-md hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100">
                      @{user.username}
                    </h1>
                    {is_own_profile && (
                      <button
                        onClick={() => setEditingUsername(true)}
                        className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Member since {formatDateDisplay(user.created_at)}
              </p>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-primary-400">{streak.current_streak}</div>
                  <div className="text-xs text-gray-400 mt-1">Current Streak</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-100">{streak.longest_streak}</div>
                  <div className="text-xs text-gray-400 mt-1">Longest Streak</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{user.trophies.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">Trophies</div>
                </div>
                <div className={`${getRankGradient(user.trophies)} rounded-lg p-3 text-center border`} style={getRankBorderStyle(user.trophies)}>
                  <div className="text-lg font-bold" style={{ ...getRankColorStyle(user.trophies), fontFamily: 'var(--font-orbitron), sans-serif' }}>
                    {getTrophyRank(user.trophies)}
                  </div>
                  <div className="text-xs mt-1" style={getRankColorStyle(user.trophies)}>Rank</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-gray-100">{stats.total_uploads}</div>
            <div className="text-sm text-gray-400 mt-1">Total Uploads</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.approved_uploads}</div>
            <div className="text-sm text-gray-400 mt-1">Approved</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending_uploads}</div>
            <div className="text-sm text-gray-400 mt-1">Pending</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.rejected_uploads}</div>
            <div className="text-sm text-gray-400 mt-1">Rejected</div>
          </div>
        </div>

        {/* Recent Uploads */}
        {recent_uploads.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Recent Uploads</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {recent_uploads.map((upload) => (
                <div key={upload.id} className="relative aspect-square rounded-lg overflow-hidden border-2 border-green-500 bg-green-900/20">
                  <Image
                    src={getImageUrl(upload.photo_path) || ''}
                    alt={`Upload from ${formatDateDisplay(upload.upload_date)}`}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 14vw"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                    {formatDateDisplay(upload.upload_date, { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recent_uploads.length === 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 text-center">
            <p className="text-gray-400">No uploads yet</p>
          </div>
        )}
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

