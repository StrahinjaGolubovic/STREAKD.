'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';
import { Chat } from '@/components/Chat';
import { formatDateSerbia, isTodaySerbia, isPastSerbia, formatDateDisplay, formatDateTimeDisplay } from '@/lib/timezone';
import { compressImageToJpeg } from '@/lib/image-compress';
import { getTrophyRank, getRankColorStyle, getRankGradient, getRankBorderStyle } from '@/lib/ranks';
import { Skeleton, SkeletonGrid, SkeletonCard, SkeletonList } from '@/components/Skeleton';
import { CircularProgress } from '@/components/CircularProgress';
import { EmptyState } from '@/components/EmptyState';

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
  trophies: number;
  userId?: number;
  username?: string;
  profilePicture?: string | null;
}

interface Friend {
  id: number;
  username: string;
  trophies: number;
  current_streak: number;
  longest_streak: number;
  profile_picture: string | null;
  created_at: string;
}

interface Crew {
  id: number;
  name: string;
  leader_username: string;
  member_count: number;
  average_streak: number;
  average_trophies: number;
  is_member: boolean;
  is_leader: boolean;
}

type TabType = 'challenge' | 'social' | 'crew';

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [profilePicBroken, setProfilePicBroken] = useState(false);
  const [brokenFriendPics, setBrokenFriendPics] = useState<Set<number>>(() => new Set());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [inviteCode, setInviteCode] = useState<string>('');
  const [inviteInput, setInviteInput] = useState('');
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [myCrew, setMyCrew] = useState<Crew | null>(null);
  const [profilePictureUploading, setProfilePictureUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('challenge');
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

  const fetchDashboard = useCallback(async () => {
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
  }, [router]);

  const fetchFriends = useCallback(async () => {
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
  }, []);

  const fetchInviteCode = useCallback(async () => {
    try {
      const response = await fetch('/api/friends/invite-code');
      if (response.ok) {
        const data = await response.json();
        setInviteCode(data.code);
      }
    } catch (err) {
      console.error('Failed to fetch invite code:', err);
    }
  }, []);

  const fetchMyCrew = useCallback(async () => {
    try {
      const response = await fetch('/api/crews/my-crew');
      if (response.ok) {
        const data = await response.json();
        setMyCrew(data.crew);
      }
    } catch (err) {
      console.error('Failed to fetch crew:', err);
    }
  }, []);

  const fetchImpersonationStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/impersonation-status');
      if (res.ok) {
        const json = await res.json();
        setIsImpersonating(!!json.impersonating);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchFriends();
    fetchInviteCode();
    fetchImpersonationStatus();
    fetchMyCrew();
  }, [fetchDashboard, fetchFriends, fetchInviteCode, fetchImpersonationStatus, fetchMyCrew]);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/user-heartbeat', { method: 'POST' });
      } catch {
        // ignore
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(heartbeatInterval);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = profileMenuRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileMenuOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileMenuOpen]);

  async function stopImpersonating() {
    try {
      const res = await fetch('/api/admin/stop-impersonate', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/admin/dashboard';
      }
    } catch {
      // ignore
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();

    try {
      const mod: any = await import('exifr');
      const exifr = mod?.default || mod;
      const exifData = await exifr.parse(file, {
        pick: [
          'DateTimeOriginal',
          'CreateDate',
          'ModifyDate',
          'GPSLatitude',
          'GPSLongitude',
          'Make',
          'Model',
          'Software',
        ],
      });
      if (exifData) {
        formData.append('metadata', JSON.stringify(exifData));
      }
    } catch (err) {
      console.error('EXIF extraction failed:', err);
    }

    try {
      let uploadFile = file;

      if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        uploadFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      }

      try {
        uploadFile = await compressImageToJpeg(uploadFile, {
          maxBytes: 1.8 * 1024 * 1024,
          maxDimension: 1920,
          quality: 0.85,
        });
      } catch (compressErr) {
        console.error('Compression failed, using original:', compressErr);
      }

      formData.append('photo', uploadFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        showToast('Photo uploaded successfully!', 'success');
        await fetchDashboard();
      } else {
        setError(result.error || 'Upload failed');
        showToast(result.error || 'Upload failed', 'error');
      }
    } catch (err) {
      setError('An error occurred while uploading');
      showToast('An error occurred while uploading', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleProfilePictureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfilePictureUploading(true);

    try {
      let uploadFile = file;

      if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        const heic2any = (await import('heic2any')).default;
        const converted = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9,
        });
        const blob = Array.isArray(converted) ? converted[0] : converted;
        uploadFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      }

      try {
        uploadFile = await compressImageToJpeg(uploadFile, {
          maxBytes: 1.8 * 1024 * 1024,
          maxDimension: 1920,
          quality: 0.85,
        });
      } catch (compressErr) {
        console.error('Compression failed, using original:', compressErr);
      }

      const formData = new FormData();
      formData.append('picture', uploadFile);

      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        if (result.profile_picture && data) {
          setData({ ...data, profilePicture: result.profile_picture });
        }
        await fetchDashboard();
        showToast('Profile picture updated!', 'success');
      } else {
        const result = await response.json();
        showToast(result.error || 'Failed to upload profile picture', 'error');
      }
    } catch (err) {
      showToast('An error occurred while uploading profile picture', 'error');
    } finally {
      setProfilePictureUploading(false);
      e.target.value = '';
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
            showToast('Profile picture removed', 'success');
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
          showToast('An error occurred', 'error');
        }
      },
      'danger'
    );
  }

  async function handleLogout() {
    showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
          router.push('/login');
          router.refresh();
        } catch (err) {
          showToast('An error occurred', 'error');
        }
      },
      'default'
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <Skeleton variant="rectangular" width={120} height={32} />
              <Skeleton variant="circular" width={40} height={40} />
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
          <SkeletonGrid count={4} />
          <div className="mt-6">
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Failed to load dashboard</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = data.progress.totalDays > 0 ? (data.progress.completedDays / data.progress.totalDays) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={140}
                height={40}
                priority
                unoptimized
                className="h-8 sm:h-10 w-auto object-contain"
              />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-600 hover:border-primary-500 transition-colors"
                >
                  {data.profilePicture && !profilePicBroken ? (
                    <Image
                      src={getImageUrl(data.profilePicture) || ''}
                      alt={data.username || 'Profile'}
                      fill
                      unoptimized
                      className="object-cover"
                      onError={() => setProfilePicBroken(true)}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-300 font-semibold">
                      {data.username?.[0].toUpperCase() || 'U'}
                    </div>
                  )}
                  {profilePictureUploading && (
                    <div className="absolute inset-0 bg-gray-900/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-400"></div>
                    </div>
                  )}
                </button>
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                />
                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-700 bg-gray-800 shadow-xl overflow-hidden z-50"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        profileFileInputRef.current?.click();
                      }}
                    >
                      Change profile picture
                    </button>
                    {data?.profilePicture && (
                      <button
                        type="button"
                        role="menuitem"
                        className="w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-gray-700 transition-colors"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleRemoveProfilePicture();
                        }}
                      >
                        Remove profile picture
                      </button>
                    )}
                    <div className="h-px bg-gray-700" />
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-gray-700 transition-colors"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
              {data && (data.username === 'admin' || data.username === 'seuq' || data.username === 'jakow' || data.username === 'nikola') && (
                <Link
                  href="/admin/dashboard"
                  className="hidden sm:block text-primary-400 hover:text-primary-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Hero Stats Section - Creative Layout */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-gray-800 via-gray-800/95 to-gray-800/90 border border-gray-700 rounded-2xl p-4 sm:p-6 md:p-8 shadow-xl overflow-hidden relative">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-100 mb-2">
                    Welcome back, <span className="text-primary-400">@{data.username}</span>
                  </h1>
                  <p className="text-sm sm:text-base text-gray-400">
                    {getTrophyRank(data.trophies)} • {data.trophies.toLocaleString()} trophies
                  </p>
                </div>
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-primary-400">{data.streak.current_streak}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Day Streak</div>
                  </div>
                  <div className="h-12 w-px bg-gray-700" />
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-yellow-400">{data.trophies.toLocaleString()}</div>
                    <div className="text-xs sm:text-sm text-gray-400">Trophies</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Bar */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-gray-700/50 rounded-xl p-3 sm:p-4 text-center border border-gray-600/50">
                  <div className="text-lg sm:text-xl font-bold text-gray-100">{data.streak.current_streak}</div>
                  <div className="text-xs text-gray-400 mt-1">Current</div>
                </div>
                <div className="bg-gray-700/50 rounded-xl p-3 sm:p-4 text-center border border-gray-600/50">
                  <div className="text-lg sm:text-xl font-bold text-gray-100">{data.streak.longest_streak}</div>
                  <div className="text-xs text-gray-400 mt-1">Longest</div>
                </div>
                <div className={`${getRankGradient(data.trophies)} rounded-xl p-3 sm:p-4 text-center border`} style={getRankBorderStyle(data.trophies)}>
                  <div className="text-lg sm:text-xl font-bold" style={getRankColorStyle(data.trophies)}>
                    {getTrophyRank(data.trophies)}
                  </div>
                  <div className="text-xs mt-1" style={getRankColorStyle(data.trophies)}>Rank</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-700 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('challenge')}
              className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'challenge'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Challenge
            </button>
            <button
              onClick={() => setActiveTab('social')}
              className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'social'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Social
            </button>
            {myCrew && (
              <button
                onClick={() => setActiveTab('crew')}
                className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === 'crew'
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Crew
              </button>
            )}
            {!myCrew && (
              <Link
                href="/crews"
                className="px-4 sm:px-6 py-3 font-medium text-sm sm:text-base whitespace-nowrap border-b-2 border-transparent text-gray-400 hover:text-gray-300 transition-colors"
              >
                Join Crew →
              </Link>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'challenge' && (
          <div className="space-y-6">
            {/* Weekly Challenge Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-4 sm:p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-1">Weekly Challenge</h2>
                  <p className="text-sm text-gray-400">
                    {formatDateDisplay(data.challenge.start_date)} - {formatDateDisplay(data.challenge.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <CircularProgress
                    value={progressPercentage}
                    size={80}
                    strokeWidth={6}
                    showLabel={true}
                    color={progressPercentage >= 71.4 ? 'green' : progressPercentage >= 50 ? 'primary' : 'red'}
                  />
                  <div>
                    <div className="text-2xl sm:text-3xl font-bold text-primary-400">
                      {data.progress.completedDays}/{data.progress.totalDays}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">days</div>
                  </div>
                </div>
              </div>

              {/* Days Grid - Compact */}
              <div className="grid grid-cols-7 gap-2 mb-6">
                {data.progress.days.map((day) => {
                  const dayName = formatDateDisplay(day.date, { weekday: 'short' });
                  const dayNumber = parseInt(day.date.split('-')[2], 10);
                  const isToday = isTodaySerbia(day.date);
                  const isPast = isPastSerbia(day.date);

                  return (
                    <div
                      key={day.date}
                      className={`aspect-square rounded-xl p-2 text-center border-2 transition-all ${
                        day.uploaded
                          ? day.verification_status === 'pending'
                            ? 'border-yellow-500 bg-yellow-900/20'
                            : day.verification_status === 'rejected'
                            ? 'border-red-500 bg-red-900/20'
                            : 'border-green-500 bg-green-900/20'
                          : isToday
                          ? 'border-yellow-500 bg-yellow-900/20'
                          : isPast
                          ? 'border-red-700 bg-red-900/20'
                          : 'border-gray-700 bg-gray-700/50'
                      }`}
                    >
                      <div className="text-[10px] sm:text-xs text-gray-400 mb-1">{dayName}</div>
                      <div className="text-base sm:text-lg font-bold text-gray-100">{dayNumber}</div>
                      {day.uploaded && day.photo_path && (
                        <div className="mt-1 relative w-full aspect-square rounded overflow-hidden bg-gray-700">
                          <Image
                            src={getImageUrl(day.photo_path) || ''}
                            alt={`Photo for ${day.date}`}
                            fill
                            unoptimized
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, 200px"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Upload Button */}
              <div className="border-t border-gray-700 pt-4 sm:pt-6">
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <div className="w-full bg-primary-600 text-white px-6 py-3.5 rounded-xl hover:bg-primary-700 active:bg-primary-800 text-center font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-lg hover:shadow-xl cursor-pointer">
                    {uploading ? 'Uploading...' : '📸 Upload Today\'s Photo'}
                  </div>
                </label>
                {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'social' && (
          <div className="space-y-6">
            {/* Friends Section */}
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-100">Friends</h2>
                <span className="text-sm text-gray-400">{friends.length}</span>
              </div>

              {/* Invite Code */}
              <div className="bg-gray-700/50 rounded-xl p-4 mb-4 sm:mb-6">
                <div className="text-sm font-medium text-gray-300 mb-2">Your Invite Code</div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 font-mono text-sm sm:text-base font-bold text-primary-400">
                    {inviteCode || 'Loading...'}
                  </div>
                  <button
                    onClick={handleCopyInviteCode}
                    disabled={!inviteCode}
                    className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Add Friend */}
              <form onSubmit={handleAcceptInvite} className="mb-4 sm:mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                    placeholder="Enter invite code"
                    maxLength={8}
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono uppercase"
                  />
                  <button
                    type="submit"
                    disabled={!inviteInput.trim() || inviteLoading}
                    className="px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    {inviteLoading ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>

              {/* Friends List */}
              {friendsLoading ? (
                <SkeletonList count={3} />
              ) : friends.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No friends yet"
                  description="Share your invite code to start building your network!"
                />
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="bg-gray-700/50 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-700 transition-colors"
                    >
                      {friend.profile_picture && !brokenFriendPics.has(friend.id) ? (
                        <Image
                          src={getImageUrl(friend.profile_picture) || ''}
                          alt={friend.username}
                          width={48}
                          height={48}
                          className="rounded-full border-2 border-gray-600"
                          unoptimized
                          onError={() => setBrokenFriendPics((prev) => new Set(prev).add(friend.id))}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-gray-300 font-bold">
                          {friend.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-100 truncate">@{friend.username}</div>
                        <div className="text-xs sm:text-sm text-gray-400">
                          🏆 {friend.trophies} • 🔥 {friend.current_streak} days
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        className="px-3 py-2 bg-red-900/50 border border-red-700 text-red-300 rounded-lg hover:bg-red-900/70 transition-colors text-xs sm:text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat Section */}
            {data?.userId && data?.username && (
              <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-4 sm:p-6">
                <Chat
                  currentUserId={data.userId}
                  currentUsername={data.username}
                  currentUserProfilePicture={data.profilePicture}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'crew' && myCrew && (
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-1">{myCrew.name}</h2>
                <p className="text-sm text-gray-400">by @{myCrew.leader_username}</p>
              </div>
              <Link
                href="/crews"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                View Details
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-gray-100">{myCrew.member_count}/30</div>
                <div className="text-xs text-gray-400 mt-1">Members</div>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-primary-400">{myCrew.average_streak}</div>
                <div className="text-xs text-gray-400 mt-1">Avg Streak</div>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">{myCrew.average_trophies}</div>
                <div className="text-xs text-gray-400 mt-1">Avg Trophies</div>
              </div>
            </div>
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
