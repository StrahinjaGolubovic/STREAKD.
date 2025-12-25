'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getImageUrl } from '@/lib/image-utils';
import { Chat } from '@/components/Chat';
import { ImageCropper } from '@/components/ImageCropper';
import { Notifications } from '@/components/Notifications';
import { formatDateSerbia, isTodaySerbia, isPastSerbia, formatDateDisplay, formatDateTimeDisplay } from '@/lib/timezone';
import { compressImageToJpeg } from '@/lib/image-compress';
import { getTrophyRank, getRankColorStyle, getRankGradient, getRankBorderStyle } from '@/lib/ranks';

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
  nudged_today?: boolean;
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

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [profilePicBroken, setProfilePicBroken] = useState(false);
  const [brokenFriendPics, setBrokenFriendPics] = useState<Set<number>>(() => new Set());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuMobileRef = useRef<HTMLDivElement>(null);
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
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [friendsScrollPosition, setFriendsScrollPosition] = useState({ atStart: true, atEnd: false });
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
      const desktopEl = profileMenuRef.current;
      const mobileEl = profileMenuMobileRef.current;
      const target = e.target as Node;
      
      if (desktopEl?.contains(target) || mobileEl?.contains(target)) {
        return;
      }
      
      setProfileMenuOpen(false);
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

    // Show cropper with the selected image
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setCroppingImage(imageUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleCroppedImage(croppedImageUrl: string) {
    setCroppingImage(null);
    setProfilePictureUploading(true);

    try {
      // Convert data URL to File
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });

      let uploadFile = file;
      try {
        uploadFile = await compressImageToJpeg(file, {
          maxBytes: 1.8 * 1024 * 1024,
          maxDimension: 1920,
          quality: 0.85,
        });
      } catch (compressErr) {
        console.error('Compression failed, using original:', compressErr);
      }

      const formData = new FormData();
      formData.append('picture', uploadFile);

      const uploadResponse = await fetch('/api/profile/picture', {
        method: 'POST',
        body: formData,
      });

      if (uploadResponse.ok) {
        const result = await uploadResponse.json();
        if (result.profile_picture && data) {
          setData({ ...data, profilePicture: result.profile_picture });
        }
        await fetchDashboard();
        showToast('Profile picture updated!', 'success');
      } else {
        const result = await uploadResponse.json();
        showToast(result.error || 'Failed to upload profile picture', 'error');
      }
    } catch (err) {
      showToast('An error occurred while uploading profile picture', 'error');
    } finally {
      setProfilePictureUploading(false);
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

  const progressPercentage = data.progress.totalDays > 0 ? (data.progress.completedDays / data.progress.totalDays) * 100 : 0;

  return (
    <div className="bg-gray-900">
      {isImpersonating && (
        <div className="bg-yellow-900/40 border-b border-yellow-700/60 text-yellow-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
            <div className="text-sm font-medium">
              You are currently <span className="font-semibold">logged in as another user</span> (admin impersonation).
            </div>
            <button
              onClick={stopImpersonating}
              className="px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 text-black rounded-md text-sm font-semibold"
            >
              Return to Admin
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={140}
                height={36}
                priority
                unoptimized
                className="h-8 sm:h-9 md:h-10 w-auto"
              />
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              {/* Buttons */}
              <Link
                href="/crews"
                className="text-primary-400 hover:text-primary-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
              >
                Crews
              </Link>
              {data && (data.username === 'admin' || data.username === 'seuq' || data.username === 'jakow' || data.username === 'nikola') && (
                <Link
                  href="/admin/dashboard"
                  className="text-primary-400 hover:text-primary-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md hover:bg-gray-700 transition-colors text-sm sm:text-base"
                >
                  Admin Panel
                </Link>
              )}
              {/* Notifications */}
              {data?.userId && <Notifications userId={data.userId} />}
              {/* Profile Picture */}
              <div className="relative" ref={profileMenuRef}>
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  disabled={profilePictureUploading}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  className="relative"
                >
                  {data?.profilePicture && !profilePicBroken ? (
                    <Image
                      key={`profile-img-${data.profilePicture}`}
                      src={getImageUrl(data.profilePicture) || ''}
                      alt="Profile picture"
                      width={48}
                      height={48}
                      unoptimized
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-600 object-cover hover:border-primary-400 transition-colors"
                      onError={() => setProfilePicBroken(true)}
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center hover:border-primary-400 transition-colors">
                      <span className="text-gray-400 text-lg font-semibold">
                        {data?.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  {profilePictureUploading && (
                    <div className="absolute inset-0 bg-gray-900/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-400"></div>
                    </div>
                  )}
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-700 bg-gray-800 shadow-xl overflow-hidden z-[60]"
                    onClick={(e) => e.stopPropagation()}
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
                    <Link
                      href={`/profile/${encodeURIComponent(data.username || '')}`}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-gray-700 transition-colors"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      View Profile
                    </Link>
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
            </div>

            {/* Mobile: Hamburger Menu + Profile Picture */}
            <div className="flex sm:hidden items-center gap-2">
              {/* Notifications on mobile */}
              {data?.userId && <Notifications userId={data.userId} />}
              
              {/* Profile Picture on mobile */}
              <div className="relative" ref={profileMenuMobileRef}>
                <input
                  ref={profileFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  disabled={profilePictureUploading}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  className="relative"
                >
                  {data?.profilePicture && !profilePicBroken ? (
                    <Image
                      key={`profile-img-${data.profilePicture}`}
                      src={getImageUrl(data.profilePicture) || ''}
                      alt="Profile picture"
                      width={40}
                      height={40}
                      unoptimized
                      className="w-10 h-10 rounded-full border-2 border-gray-600 object-cover hover:border-primary-400 transition-colors"
                      onError={() => setProfilePicBroken(true)}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center hover:border-primary-400 transition-colors">
                      <span className="text-gray-400 text-base font-semibold">
                        {data?.username?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  {profilePictureUploading && (
                    <div className="absolute inset-0 bg-gray-900/50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-400"></div>
                    </div>
                  )}
                </button>

                {profileMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-700 bg-gray-800 shadow-xl overflow-hidden z-[60]"
                    onClick={(e) => e.stopPropagation()}
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
                    <Link
                      href={`/profile/${encodeURIComponent(data.username || '')}`}
                      className="block w-full text-left px-4 py-2.5 text-sm text-gray-100 hover:bg-gray-700 transition-colors"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      View Profile
                    </Link>
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

              {/* Hamburger Menu Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="p-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-md transition-colors"
                aria-label="Toggle menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-3 pt-3 border-t border-gray-700">
              <div className="flex flex-col gap-2">
                <Link
                  href="/crews"
                  className="text-primary-400 hover:text-primary-300 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-base"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Crews
                </Link>
                {data && (data.username === 'admin' || data.username === 'seuq' || data.username === 'jakow' || data.username === 'nikola') && (
                  <Link
                    href="/admin/dashboard"
                    className="text-primary-400 hover:text-primary-300 px-3 py-2 rounded-md hover:bg-gray-700 transition-colors text-base"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin Panel
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-6 lg:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
          <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 border-2 border-yellow-600/50 rounded-lg shadow-lg p-4 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm font-medium text-yellow-300 mb-1 flex items-center gap-1.5">
              <span>🏆</span>
              <span>Trophies</span>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-400">
              {data.trophies.toLocaleString()}
            </div>
            {data.streak.current_streak >= 7 && (
              <div className="text-xs text-yellow-300/70 mt-1">
                {data.streak.current_streak >= 30 ? '2.0x' : data.streak.current_streak >= 14 ? '1.5x' : '1.2x'} streak bonus active
              </div>
            )}
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Current Streak</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-400">{data.streak.current_streak} days</div>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-5 md:p-6">
            <div className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Longest Streak</div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100">{data.streak.longest_streak} days</div>
          </div>
          <div className={`${getRankGradient(data.trophies)} rounded-lg shadow-lg p-4 sm:p-5 md:p-6`} style={getRankBorderStyle(data.trophies)}>
            <div className="text-xs sm:text-sm font-medium mb-1 flex items-center gap-1.5" style={getRankColorStyle(data.trophies)}>
              <span>⭐</span>
              <span>Rank</span>
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-bold rank-shine" style={{ ...getRankColorStyle(data.trophies), fontFamily: 'var(--font-orbitron), sans-serif' }}>
              {getTrophyRank(data.trophies)}
            </div>
          </div>
        </div>

        {/* Weekly Challenge Card */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 md:mb-6 gap-3">
            <div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100">Weekly Challenge</h2>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                {formatDateDisplay(data.challenge.start_date)} -{' '}
                {formatDateDisplay(data.challenge.end_date)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-400">
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

          {/* Upload Section */}
          <div className="border-t border-gray-700 pt-4 sm:pt-5 md:pt-6">
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
                <div className="cursor-pointer bg-primary-600 text-white px-5 sm:px-6 py-3 sm:py-3.5 rounded-md hover:bg-primary-700 active:bg-primary-800 text-center text-base sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation min-h-[44px] flex items-center justify-center">
                  {uploading ? 'Uploading...' : 'Choose Photo'}
                </div>
              </label>
              {error && <div className="text-red-400 text-sm sm:text-base">{error}</div>}
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 sm:mt-3">
              Upload one photo per day as proof of your gym visit
            </p>
          </div>
        </div>

        {/* Days Grid */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mb-3 sm:mb-4 md:mb-6">This Week's Progress</h2>
          {/* Mobile: Horizontal scroll, Desktop: Grid */}
          <div className="block sm:hidden">
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-hide">
              {data.progress.days.map((day, index) => {
                const dayName = formatDateDisplay(day.date, { weekday: 'short' });
                const dayNumber = parseInt(day.date.split('-')[2], 10);
                const isToday = isTodaySerbia(day.date);
                const isPast = isPastSerbia(day.date);

                return (
                  <div
                    key={day.date}
                    className={`border-2 rounded-lg p-3 text-center flex-shrink-0 w-[85px] ${
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
                    <div className="text-xs font-medium text-gray-400">{dayName}</div>
                    <div className="text-xl font-bold text-gray-100 mt-1">{dayNumber}</div>
                    {day.uploaded ? (
                      <div className="mt-2">
                        {day.verification_status === 'pending' ? (
                          <div className="text-yellow-400 text-[10px] font-medium bg-yellow-900/30 px-1.5 py-0.5 rounded">Verifying</div>
                        ) : day.verification_status === 'rejected' ? (
                          <div className="text-red-400 text-[10px] font-medium">✗ Rejected</div>
                        ) : (
                          <div className="text-green-400 text-[10px] font-medium">✓ Uploaded</div>
                        )}
                      </div>
                    ) : isToday ? (
                      <div className="mt-2 text-yellow-400 text-[10px] font-medium bg-yellow-900/30 px-1.5 py-0.5 rounded">Missing</div>
                    ) : isPast ? (
                      <div className="mt-2 text-red-400 text-[10px] font-medium">✗ Missed</div>
                    ) : (
                      <div className="mt-2 text-gray-500 text-[10px]">Pending</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Desktop: Grid layout */}
          <div className="hidden sm:grid grid-cols-7 gap-2 sm:gap-3 md:gap-4">
            {data.progress.days.map((day, index) => {
              const dayName = formatDateDisplay(day.date, { weekday: 'short' });
              const dayNumber = parseInt(day.date.split('-')[2], 10);
              const isToday = isTodaySerbia(day.date);
              const isPast = isPastSerbia(day.date);

              return (
                <div
                  key={day.date}
                  className={`border-2 rounded-lg p-2 sm:p-3 md:p-4 text-center ${
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
                  <div className="text-xs sm:text-sm font-medium text-gray-400">{dayName}</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mt-1">{dayNumber}</div>
                  {day.uploaded ? (
                    <div className="mt-2">
                      {day.verification_status === 'pending' ? (
                        <div className="text-yellow-400 text-xs font-medium bg-yellow-900/30 px-2 py-1 rounded mb-2">Verifying</div>
                      ) : day.verification_status === 'rejected' ? (
                        <div className="text-red-400 text-xs font-medium mb-2">✗ Rejected</div>
                      ) : (
                        <div className="text-green-400 text-xs font-medium mb-2">✓ Uploaded</div>
                      )}
                      {day.photo_path && (
                        <div className="mt-2 relative w-full aspect-square rounded overflow-hidden bg-gray-700">
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
                  ) : isToday ? (
                    <div className="mt-2 text-yellow-400 text-xs font-medium bg-yellow-900/30 px-2 py-1 rounded">Missing</div>
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

        {/* Crew Section */}
        {myCrew && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mb-2">My Crew: {myCrew.name}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Members:</span>
                    <span className="ml-2 text-gray-100 font-semibold">{myCrew.member_count}/30</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Streak:</span>
                    <span className="ml-2 text-gray-100 font-semibold">{myCrew.average_streak}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Avg Trophies:</span>
                    <span className="ml-2 text-gray-100 font-semibold">{myCrew.average_trophies}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Leader:</span>
                    <span className="ml-2 text-gray-100 font-semibold">@{myCrew.leader_username}</span>
                  </div>
                </div>
              </div>
              <Link
                href="/crews"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm sm:text-base text-center"
              >
                View Crew
              </Link>
            </div>
          </div>
        )}

        {/* Friends Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-5 md:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mb-4 sm:mb-5 md:mb-6">Friends</h2>

          {/* Invite Code Section */}
          <div className="mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 bg-gray-700/50 rounded-lg">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-100 mb-3 sm:mb-4">Your Invite Code</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-3 sm:px-4 py-3 sm:py-3.5 font-mono text-sm sm:text-base md:text-lg font-bold text-primary-400 break-all min-h-[44px] flex items-center">
                {inviteCode || 'Loading...'}
              </div>
              <button
                onClick={handleCopyInviteCode}
                disabled={!inviteCode}
                className="px-5 sm:px-6 py-3 sm:py-3.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base sm:text-base whitespace-nowrap touch-manipulation min-h-[44px]"
              >
                Copy
              </button>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 sm:mt-3">
              Share this code with friends so they can add you!
            </p>
          </div>

          {/* Accept Invite Section */}
          <div className="mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 bg-gray-700/50 rounded-lg">
            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-100 mb-3 sm:mb-4">Add Friend by Invite Code</h3>
            <form onSubmit={handleAcceptInvite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <input
                type="text"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                maxLength={8}
                className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-4 sm:px-4 py-3 sm:py-3.5 text-base sm:text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono uppercase min-h-[44px]"
              />
              <button
                type="submit"
                disabled={!inviteInput.trim() || inviteLoading}
                className="px-5 sm:px-6 py-3 sm:py-3.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-base sm:text-base whitespace-nowrap touch-manipulation min-h-[44px]"
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
              <div className="relative flex justify-center">
                {/* Left Arrow */}
                {!friendsScrollPosition.atStart && (
                  <button
                    onClick={() => {
                      const container = document.getElementById('friends-scroll-container');
                      if (container) {
                        container.scrollBy({ left: -300, behavior: 'smooth' });
                      }
                    }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 rounded-full transition-colors shadow-lg"
                    aria-label="Scroll left"
                  >
                    <svg className="w-6 h-6 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}

                {/* Right Arrow */}
                {!friendsScrollPosition.atEnd && (
                  <button
                    onClick={() => {
                      const container = document.getElementById('friends-scroll-container');
                      if (container) {
                        container.scrollBy({ left: 300, behavior: 'smooth' });
                      }
                    }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 rounded-full transition-colors shadow-lg"
                    aria-label="Scroll right"
                  >
                    <svg className="w-6 h-6 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                {/* Scrollable Container */}
                <div 
                  id="friends-scroll-container"
                  className="flex gap-3 sm:gap-4 overflow-x-auto py-2 scroll-smooth scrollbar-hide max-w-full"
                  onScroll={(e) => {
                    const container = e.currentTarget;
                    const atStart = container.scrollLeft <= 0;
                    const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;
                    setFriendsScrollPosition({ atStart, atEnd });
                  }}
                >
                  {friends.map((friend) => {
                    return (
                      <div
                        key={friend.id}
                        className="flex-shrink-0 w-40 sm:w-48"
                      >
                        <Link
                          href={`/profile/${encodeURIComponent(friend.username)}`}
                          className="block bg-gray-700/50 border border-gray-600 rounded-lg p-4 hover:bg-gray-700 hover:border-gray-500 transition-all"
                        >
                          <div className="flex flex-col items-center gap-3">
                            {/* Profile Picture */}
                            {friend.profile_picture ? (
                              !brokenFriendPics.has(friend.id) ? (
                                <Image
                                  src={getImageUrl(friend.profile_picture) || ''}
                                  alt={friend.username}
                                  width={96}
                                  height={96}
                                  unoptimized
                                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-gray-600 object-cover"
                                  onError={() =>
                                    setBrokenFriendPics((prev) => {
                                      const next = new Set(prev);
                                      next.add(friend.id);
                                      return next;
                                    })
                                  }
                                />
                              ) : (
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                                  <span className="text-gray-400 text-2xl sm:text-3xl font-semibold">
                                    {friend.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )
                            ) : (
                              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                                <span className="text-gray-400 text-2xl sm:text-3xl font-semibold">
                                  {friend.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            
                            {/* Username */}
                            <div className="text-center w-full">
                              <h4 className="text-sm sm:text-base font-semibold text-gray-100 truncate">
                                @{friend.username}
                              </h4>
                              <div className="flex items-center justify-center gap-1 mt-1">
                                <span className="text-yellow-400 text-xs">🏆</span>
                                <span className="text-xs text-gray-400">{friend.trophies.toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Streak */}
                            <div className="text-center">
                              <div className="text-xs text-gray-500">Streak</div>
                              <div className="text-sm font-semibold text-primary-400">
                                {friend.current_streak} days
                              </div>
                            </div>
                          </div>
                        </Link>
                        
                        {/* Action Buttons - Below card */}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (friend.nudged_today) return;
                              try {
                                const response = await fetch('/api/friends/nudge', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ friend_id: friend.id }),
                                });
                                if (response.ok) {
                                  showToast(`Nudged @${friend.username}!`, 'success');
                                  fetchFriends();
                                } else {
                                  const data = await response.json();
                                  if (response.status === 429) {
                                    fetchFriends();
                                  } else {
                                    showToast(data.error || 'Failed to nudge friend', 'error');
                                  }
                                }
                              } catch (err) {
                                showToast('An error occurred while nudging friend', 'error');
                              }
                            }}
                            disabled={friend.nudged_today}
                            className={`flex-1 px-3 py-2 border rounded-md text-sm transition-colors ${
                              friend.nudged_today
                                ? 'bg-gray-700/50 border-gray-600 text-gray-500 cursor-not-allowed'
                                : 'bg-primary-600/50 border-primary-700 text-primary-300 hover:bg-primary-600/70'
                            }`}
                          >
                            👋 {friend.nudged_today ? 'Nudged' : 'Nudge'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveFriend(friend.id);
                            }}
                            className="px-3 py-2 bg-red-900/50 border border-red-700 text-red-300 rounded-md hover:bg-red-900/70 transition-colors text-sm"
                            title="Remove friend"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Chat Section */}
        {data?.userId && data?.username && (
          <div className="mb-4 sm:mb-6">
            <Chat
              currentUserId={data.userId}
              currentUsername={data.username}
              currentUserProfilePicture={data.profilePicture}
            />
          </div>
        )}
      </main>

      {croppingImage && (
        <ImageCropper
          image={croppingImage}
          onCropComplete={handleCroppedImage}
          onCancel={() => setCroppingImage(null)}
        />
      )}
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
