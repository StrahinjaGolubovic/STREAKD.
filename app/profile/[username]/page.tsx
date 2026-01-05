'use client';

import { useCallback, useEffect, useState } from 'react';
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
    profile_private: boolean;
    crew: { id: number; name: string; tag: string | null; tag_color: string } | null;
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
  viewer_is_crew_leader?: boolean;
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
  const [privacyUpdating, setPrivacyUpdating] = useState(false);
  const [invitingToCrew, setInvitingToCrew] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (response.ok) {
        const data = await response.json();
        setProfileData(data);
        setNewUsername(data.user.username);
      } else if (response.status === 404) {
        setError('User not found');
      } else if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'This user has privated their account');
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username, fetchProfile]);

  async function handleUpdatePrivacy(isPrivate: boolean) {
    setPrivacyUpdating(true);
    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_private: isPrivate }),
      });

      const data = await response.json();

      if (response.ok) {
        if (profileData) {
          setProfileData({
            ...profileData,
            user: { ...profileData.user, profile_private: isPrivate },
          });
        }
        showToast(isPrivate ? 'Profile set to private' : 'Profile set to public', 'success');
      } else {
        showToast(data.error || 'Failed to update privacy setting', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    } finally {
      setPrivacyUpdating(false);
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

  async function handleInviteToCrew() {
    if (!profileData) return;
    
    setInvitingToCrew(true);
    try {
      const response = await fetch('/api/crews/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profileData.user.id }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Crew invite sent!', 'success');
      } else {
        showToast(data.error || 'Failed to send invite', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    } finally {
      setInvitingToCrew(false);
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  const { user, streak, stats, recent_uploads, is_own_profile } = profileData;
  const viewerIsCrewLeader = !!profileData.viewer_is_crew_leader;

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
            className="p-2 text-gray-400 hover:text-gray-100 transition-colors"
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8">
        {/* Profile Header - Enhanced */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 sm:p-8 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Profile Picture - Enhanced */}
              <div className="relative">
                {user.profile_picture && !profilePicBroken ? (
                  <Image
                    src={getImageUrl(user.profile_picture) || ''}
                    alt={user.username}
                    width={160}
                    height={160}
                    unoptimized
                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 object-cover shadow-xl ring-4 ring-gray-700/50"
                    style={getRankBorderStyle(user.trophies)}
                    onError={() => setProfilePicBroken(true)}
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 border-4 flex items-center justify-center shadow-xl ring-4 ring-gray-700/50" style={getRankBorderStyle(user.trophies)}>
                    <span className="text-gray-300 text-5xl sm:text-6xl font-bold">
                      {user.username[0].toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Rank Badge */}
                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 px-4 py-1.5 rounded-full border-2 shadow-lg`} style={getRankBorderStyle(user.trophies)}>
                  <span className="text-sm font-bold rank-shine" style={{ ...getRankColorStyle(user.trophies), fontFamily: 'var(--font-orbitron), sans-serif' }}>
                    {getTrophyRank(user.trophies)}
                  </span>
                </div>
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
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100">
                        @{user.username}
                      </h1>
                      {user.crew && (
                        user.crew.tag ? (
                          <div className="flex justify-center sm:justify-start">
                            <Link
                              href={`/crews?id=${user.crew.id}`}
                              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold border-2 hover:opacity-80 transition-opacity"
                              style={{
                                backgroundColor: `${user.crew.tag_color}20`,
                                borderColor: user.crew.tag_color,
                                color: user.crew.tag_color,
                              }}
                            >
                              <span>{user.crew.tag}</span>
                            </Link>
                          </div>
                        ) : (
                          <div className="flex justify-center sm:justify-start">
                            <Link
                              href={`/crews?id=${user.crew.id}`}
                              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-primary-600/20 border border-primary-500/50 rounded-md text-primary-300 text-sm font-medium hover:bg-primary-600/30 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span className="truncate">{user.crew.name}</span>
                            </Link>
                          </div>
                        )
                      )}
                    </div>
                    <div className="flex gap-2 justify-center md:justify-start">
                      {is_own_profile ? (
                        <>
                          <button
                            onClick={() => setEditingUsername(true)}
                            className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 active:bg-gray-500 transition-colors touch-manipulation"
                          >
                            Edit Username
                          </button>
                          <button
                            onClick={() => handleUpdatePrivacy(!user.profile_private)}
                            disabled={privacyUpdating}
                            className="px-3 py-1.5 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 active:bg-gray-500 transition-colors disabled:opacity-50 touch-manipulation"
                          >
                            {privacyUpdating ? (
                              'Updating...'
                            ) : user.profile_private ? (
                              <>
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Make Public
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                                </svg>
                                Make Private
                              </>
                            )}
                          </button>
                        </>
                      ) : !user.crew && viewerIsCrewLeader && (
                        <button
                          onClick={handleInviteToCrew}
                          disabled={invitingToCrew}
                          className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 flex items-center gap-1 touch-manipulation"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          {invitingToCrew ? 'Inviting...' : 'Invite to Crew'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-4">
                Member since {formatDateDisplay(user.created_at)}
              </p>

              {/* Quick Stats - Enhanced */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
                <div className="bg-gradient-to-br from-primary-900/30 to-primary-800/20 border border-primary-700/50 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-200 shadow-lg">
                  <div className="text-xs text-primary-300 mb-1 flex items-center justify-center gap-1 w-full">
                    <svg className="w-4 h-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                    </svg>
                    Current Streak
                  </div>
                  <div className="text-3xl font-bold text-orange-400">{streak.current_streak}</div>
                  <div className="text-xs text-gray-400 mt-1">days</div>
                </div>
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-700/50 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform duration-200 shadow-lg">
                  <div className="text-xs text-purple-300 mb-1 flex items-center justify-center gap-1 w-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Longest Streak
                  </div>
                  <div className="text-3xl font-bold text-purple-400">{streak.longest_streak}</div>
                  <div className="text-xs text-gray-400 mt-1">days</div>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-yellow-900/40 to-yellow-800/30 border-2 border-yellow-500/50 rounded-xl p-4 text-center hover:scale-105 transition-transform duration-200 shadow-xl">
                  <div className="text-xs text-yellow-300 mb-2 flex items-center justify-center gap-1">
                    <Image
                      src="/streakd_dumbbells.png"
                      alt="Dumbbells"
                      width={35}
                      height={20}
                      className="h-5 w-auto"
                      unoptimized
                    />
                    Dumbbells
                  </div>
                  <div className="text-4xl font-bold text-yellow-400">{user.trophies.toLocaleString()}</div>
                  <div className="text-xs text-yellow-500/70 mt-1">Total earned</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid - Enhanced */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 text-center hover:border-gray-600 transition-all duration-200 hover:shadow-lg group">
            <div className="text-3xl font-bold text-gray-100 group-hover:scale-110 transition-transform duration-200">{stats.total_uploads}</div>
            <div className="text-sm text-gray-400 mt-2">Total Uploads</div>
          </div>
          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/50 rounded-xl p-5 text-center hover:border-green-600 transition-all duration-200 hover:shadow-lg group">
            <div className="text-3xl font-bold text-green-400 group-hover:scale-110 transition-transform duration-200">{stats.approved_uploads}</div>
            <div className="text-sm text-green-300/70 mt-2">✓ Approved</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border border-yellow-700/50 rounded-xl p-5 text-center hover:border-yellow-600 transition-all duration-200 hover:shadow-lg group">
            <div className="text-3xl font-bold text-yellow-400 group-hover:scale-110 transition-transform duration-200">{stats.pending_uploads}</div>
            <div className="text-sm text-yellow-300/70 mt-2 flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pending
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-900/30 to-red-800/20 border border-red-700/50 rounded-xl p-5 text-center hover:border-red-600 transition-all duration-200 hover:shadow-lg group">
            <div className="text-3xl font-bold text-red-400 group-hover:scale-110 transition-transform duration-200">{stats.rejected_uploads}</div>
            <div className="text-sm text-red-300/70 mt-2">✗ Rejected</div>
          </div>
        </div>

        {/* Recent Uploads */}
        {recent_uploads.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-8 bg-gradient-to-b from-primary-400 to-primary-600 rounded-full"></div>
              <h2 className="text-2xl font-bold text-gray-100">Recent Uploads</h2>
              <div className="ml-auto text-sm text-gray-400">
                {recent_uploads.length} photo{recent_uploads.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-5">
              {recent_uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="group relative aspect-square rounded-xl overflow-hidden border-2 border-green-500 bg-green-900/20 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
                >
                  <Image
                    src={getImageUrl(upload.photo_path) || ''}
                    alt={`Upload from ${formatDateDisplay(upload.upload_date)}`}
                    fill
                    unoptimized
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent text-white p-2 sm:p-3">
                    <div className="text-xs sm:text-sm font-semibold text-center">
                      {formatDateDisplay(upload.upload_date, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="text-[10px] sm:text-xs text-green-400 text-center mt-0.5">✓ Approved</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recent_uploads.length === 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-12 text-center">
            <div className="mb-4 flex justify-center">
              <svg className="w-16 h-16 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-xl text-gray-400 mb-2">No uploads yet</p>
            <p className="text-sm text-gray-500">Start your fitness journey by uploading your first workout photo!</p>
          </div>
        )}

      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

