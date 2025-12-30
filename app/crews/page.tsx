'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ToastContainer, Toast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CrewChat } from '@/components/CrewChat';
import { getImageUrl } from '@/lib/image-utils';

interface CrewInfo {
  id: number;
  name: string;
  leader_username: string;
  tag: string | null;
  tag_color: string;
  member_count: number;
  average_streak: number;
  average_trophies: number;
  is_member: boolean;
  is_leader: boolean;
  has_pending_request: boolean;
}

interface CrewMemberInfo {
  id: number;
  user_id: number;
  username: string;
  trophies: number;
  current_streak: number;
  longest_streak: number;
  profile_picture: string | null;
  joined_at: string;
  is_leader: boolean;
}

interface CrewRequestInfo {
  id: number;
  crew_id: number;
  crew_name: string;
  user_id: number;
  username: string;
  trophies: number;
  current_streak: number;
  created_at: string;
}

export default function CrewsPage() {
  const router = useRouter();
  const [myCrew, setMyCrew] = useState<CrewInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CrewInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCrewName, setNewCrewName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [crewDetails, setCrewDetails] = useState<{
    crew: CrewInfo;
    members: CrewMemberInfo[];
    requests: CrewRequestInfo[];
  } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [autoOpenCrewId, setAutoOpenCrewId] = useState<number | null>(null);
  const [brokenPics, setBrokenPics] = useState<Set<number>>(() => new Set());
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [currentUserProfilePicture, setCurrentUserProfilePicture] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showTagSettings, setShowTagSettings] = useState(false);
  const [crewTag, setCrewTag] = useState('');
  const [crewTagColor, setCrewTagColor] = useState('#0ea5e9');
  const [updatingTag, setUpdatingTag] = useState(false);
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

  const fetchMyCrew = useCallback(async () => {
    try {
      const response = await fetch('/api/crews/my-crew');
      if (response.ok) {
        const data = await response.json();
        setMyCrew(data.crew);
      }
    } catch (err) {
      console.error('Error fetching my crew:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyCrew();
    // Fetch current user info for crew chat
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.userId) {
          setCurrentUserId(data.userId);
          setCurrentUsername(data.username || '');
          setCurrentUserProfilePicture(data.profilePicture || null);
        }
      })
      .catch(() => {
        // Ignore errors
      });

    // Check for crew ID in URL query parameter
    const params = new URLSearchParams(window.location.search);
    const crewId = params.get('id');
    if (crewId) {
      setAutoOpenCrewId(parseInt(crewId, 10));
    }
  }, [fetchMyCrew]);

  // Auto-open crew details if crew ID is in URL
  useEffect(() => {
    if (autoOpenCrewId && !showDetailsModal) {
      fetchCrewDetails(autoOpenCrewId);
      setAutoOpenCrewId(null); // Clear after opening
    }
  }, [autoOpenCrewId, showDetailsModal]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/crews/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.crews || []);
      }
    } catch (err) {
      console.error('Error searching crews:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

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

  async function handleCreateCrew() {
    if (!newCrewName.trim()) {
      showToast('Please enter a crew name', 'error');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/crews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCrewName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Crew created successfully!', 'success');
        setShowCreateModal(false);
        setNewCrewName('');
        await fetchMyCrew();
      } else {
        showToast(data.error || 'Failed to create crew', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRequestJoin(crewId: number) {
    try {
      const response = await fetch('/api/crews/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crewId }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Join request sent!', 'success');
        // Refresh search results to update request status
        handleSearch(searchQuery);
      } else {
        showToast(data.error || 'Failed to send request', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function handleAcceptRequest(requestId: number) {
    try {
      const response = await fetch('/api/crews/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Request accepted!', 'success');
        await fetchCrewDetails(crewDetails!.crew.id);
      } else {
        showToast(data.error || 'Failed to accept request', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function handleRejectRequest(requestId: number) {
    try {
      const response = await fetch('/api/crews/reject-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Request rejected', 'info');
        await fetchCrewDetails(crewDetails!.crew.id);
      } else {
        showToast(data.error || 'Failed to reject request', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    }
  }

  async function handleLeaveCrew() {
    showConfirm(
      'Leave Crew',
      'Are you sure you want to leave this crew?',
      async () => {
        try {
          const response = await fetch('/api/crews/leave', {
            method: 'POST',
          });

          const data = await response.json();

          if (response.ok) {
            showToast('Left crew successfully', 'success');
            setMyCrew(null);
            if (showDetailsModal) {
              setShowDetailsModal(false);
              setCrewDetails(null);
            }
          } else {
            showToast(data.error || 'Failed to leave crew', 'error');
          }
        } catch (err) {
          showToast('An error occurred', 'error');
        }
      },
      'danger'
    );
  }

  async function fetchCrewDetails(crewId: number) {
    try {
      const response = await fetch(`/api/crews/${crewId}`);
      if (response.ok) {
        const data = await response.json();
        setCrewDetails(data);
        setCrewTag(data.crew.tag || '');
        setCrewTagColor(data.crew.tag_color || '#0ea5e9');
        setShowDetailsModal(true);
      }
    } catch (err) {
      console.error('Error fetching crew details:', err);
    }
  }

  async function handleUpdateTag() {
    if (crewTag.trim() && (crewTag.trim().length < 3 || crewTag.trim().length > 4)) {
      showToast('Tag must be between 3 and 4 characters', 'error');
      return;
    }

    setUpdatingTag(true);
    try {
      const response = await fetch('/api/crews/update-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewId: crewDetails!.crew.id,
          tag: crewTag.trim() || null,
          tagColor: crewTagColor,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || 'Tag updated successfully', 'success');
        setShowTagSettings(false);
        await fetchCrewDetails(crewDetails!.crew.id);
        // Refresh myCrew to update the tag in the main display
        await fetchMyCrew();
      } else {
        showToast(data.error || 'Failed to update tag', 'error');
      }
    } catch (err) {
      showToast('An error occurred', 'error');
    } finally {
      setUpdatingTag(false);
    }
  }

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={180}
                height={52}
                priority
                unoptimized
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </Link>
            <Link
              href="/dashboard"
              className="p-2 text-gray-400 hover:text-gray-100 transition-colors"
              aria-label="Dashboard"
              title="Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-2">Crews</h1>
          <p className="text-gray-400">Join or create a crew to compete with others!</p>
        </div>

        {/* My Crew Section */}
        {myCrew && (
          <div className="bg-gradient-to-br from-gray-800 to-gray-800/90 border-2 border-primary-500/30 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-100">{myCrew.name}</h2>
                  {myCrew.tag && (
                    <span
                      className="px-2.5 py-1 rounded-md text-sm font-bold border-2"
                      style={{
                        backgroundColor: `${myCrew.tag_color}20`,
                        borderColor: myCrew.tag_color,
                        color: myCrew.tag_color,
                      }}
                    >
                      {myCrew.tag}
                    </span>
                  )}
                  {myCrew.is_leader && (
                    <span className="px-2 py-1 bg-yellow-600/20 border border-yellow-600/50 text-yellow-400 text-xs font-semibold rounded-full">
                      Leader
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-2 sm:p-3">
                    <div className="text-xs text-gray-400 mb-1">Members</div>
                    <div className="text-base sm:text-lg font-bold text-gray-100">{myCrew.member_count}/30</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-2 sm:p-3">
                    <div className="text-xs text-gray-400 mb-1">Avg Streak</div>
                    <div className="text-base sm:text-lg font-bold text-primary-400">{myCrew.average_streak}</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-2 sm:p-3">
                    <div className="text-xs text-gray-400 mb-1">Avg Dumbbells</div>
                    <div className="text-base sm:text-lg font-bold text-yellow-400">{myCrew.average_trophies}</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-2 sm:p-3">
                    <div className="text-xs text-gray-400 mb-1">Leader</div>
                    <div className="text-sm font-semibold text-gray-100 truncate">@{myCrew.leader_username}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => fetchCrewDetails(myCrew.id)}
                  className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors font-medium text-sm sm:text-base shadow-md"
                >
                  View Details
                </button>
                {!myCrew.is_leader && (
                  <button
                    onClick={handleLeaveCrew}
                    className="px-4 py-2.5 bg-red-600/80 text-white rounded-lg hover:bg-red-600 active:bg-red-700 transition-colors font-medium text-sm sm:text-base shadow-md"
                  >
                    Leave
                  </button>
                )}
              </div>
            </div>

            {/* Crew Chat */}
            {currentUserId && currentUsername && (
              <div className="mt-6">
                <CrewChat
                  crewId={myCrew.id}
                  currentUserId={currentUserId}
                  currentUsername={currentUsername}
                  currentUserProfilePicture={currentUserProfilePicture}
                />
              </div>
            )}
          </div>
        )}

        {/* Search and Create Section */}
        {!myCrew && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search crews by name..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                />
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors whitespace-nowrap font-medium shadow-md"
              >
                + Create Crew
              </button>
            </div>

            {/* Search Results */}
            {searching && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto"></div>
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8">
                <div className="mb-4 flex justify-center">
                  <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-100 mb-2">No crews found</h3>
                <p className="text-sm text-gray-400 mb-4">
                  No crews match &ldquo;{searchQuery}&rdquo;. Try a different search term or create your own crew!
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Create Crew
                </button>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                {searchResults.map((crew) => (
                  <div
                    key={crew.id}
                    className="bg-gray-700/80 border border-gray-600 rounded-xl p-4 sm:p-5 hover:bg-gray-700 transition-colors shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-100">{crew.name}</h3>
                          {crew.tag && (
                            <span
                              className="px-2.5 py-1 rounded-md text-sm font-bold border-2"
                              style={{
                                backgroundColor: `${crew.tag_color}20`,
                                borderColor: crew.tag_color,
                                color: crew.tag_color,
                              }}
                            >
                              {crew.tag}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">by @{crew.leader_username}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                          <div className="bg-gray-600/50 rounded-lg p-2">
                            <div className="text-xs text-gray-400 mb-1">Members</div>
                            <div className="text-sm font-semibold text-gray-100">{crew.member_count}/30</div>
                          </div>
                          <div className="bg-gray-600/50 rounded-lg p-2">
                            <div className="text-xs text-gray-400 mb-1">Avg Streak</div>
                            <div className="text-sm font-semibold text-primary-400">{crew.average_streak}</div>
                          </div>
                          <div className="bg-gray-600/50 rounded-lg p-2">
                            <div className="text-xs text-gray-400 mb-1">Avg Dumbbells</div>
                            <div className="text-sm font-semibold text-yellow-400">{crew.average_trophies}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => fetchCrewDetails(crew.id)}
                          className="px-4 py-2.5 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500 active:bg-gray-400 transition-colors font-medium text-sm shadow-sm"
                        >
                          View
                        </button>
                        {!crew.has_pending_request && !crew.is_member && (
                          <button
                            onClick={() => handleRequestJoin(crew.id)}
                            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors font-medium text-sm shadow-md"
                          >
                            Request Join
                          </button>
                        )}
                        {crew.has_pending_request && (
                          <button
                            disabled
                            className="px-4 py-2.5 bg-yellow-600/30 border border-yellow-600/50 text-yellow-400 rounded-lg cursor-not-allowed font-medium text-sm"
                          >
                            Pending
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Crew Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 sm:p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-100">Create New Crew</h3>
              </div>
              <div className="mb-5 sm:mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Crew Name</label>
                <input
                  type="text"
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  placeholder="Enter crew name..."
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-base"
                  maxLength={30}
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-400">3-30 characters, letters, numbers, underscores, and spaces</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleCreateCrew}
                  disabled={creating}
                  className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-md"
                >
                  {creating ? 'Creating...' : 'Create Crew'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCrewName('');
                  }}
                  className="px-4 py-3 bg-gray-600 text-gray-100 rounded-lg hover:bg-gray-500 active:bg-gray-400 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Crew Details Modal */}
        {showDetailsModal && crewDetails && (
          <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-100">{crewDetails.crew.name}</h3>
                  {crewDetails.crew.tag && (
                    <span
                      className="px-2.5 py-1 rounded-md text-sm font-bold border-2"
                      style={{
                        backgroundColor: `${crewDetails.crew.tag_color}20`,
                        borderColor: crewDetails.crew.tag_color,
                        color: crewDetails.crew.tag_color,
                      }}
                    >
                      {crewDetails.crew.tag}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl sm:text-3xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Crew Tag Settings (Leader Only) */}
              {crewDetails.crew.is_leader && (
                <div className="mb-4 sm:mb-6 p-4 bg-gray-700/50 border border-gray-600 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base sm:text-lg font-semibold text-gray-100 flex items-center gap-2">
                      <span>⚙️</span>
                      <span>Crew Tag Settings</span>
                    </h4>
                    <button
                      onClick={() => setShowTagSettings(!showTagSettings)}
                      className="px-3 py-1.5 text-sm bg-gray-600 text-gray-100 rounded-md hover:bg-gray-500 transition-colors"
                    >
                      {showTagSettings ? 'Hide' : 'Edit'}
                    </button>
                  </div>
                  {showTagSettings && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Crew Tag (3-4 characters, uppercase letters and numbers only)
                        </label>
                        <input
                          type="text"
                          value={crewTag}
                          onChange={(e) => setCrewTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          placeholder="e.g., GYMB"
                          maxLength={4}
                          className="w-full px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg font-bold"
                        />
                        <p className="mt-1 text-xs text-gray-400">Leave empty to remove tag</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tag Color
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={crewTagColor}
                            onChange={(e) => setCrewTagColor(e.target.value)}
                            className="w-16 h-10 rounded cursor-pointer"
                          />
                          <input
                            type="text"
                            value={crewTagColor}
                            onChange={(e) => setCrewTagColor(e.target.value)}
                            placeholder="#0ea5e9"
                            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                          />
                        </div>
                        {crewTag && (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-sm text-gray-400">Preview:</span>
                            <span
                              className="px-2.5 py-1 rounded-md text-sm font-bold border-2"
                              style={{
                                backgroundColor: `${crewTagColor}20`,
                                borderColor: crewTagColor,
                                color: crewTagColor,
                              }}
                            >
                              {crewTag}
                            </span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleUpdateTag}
                        disabled={updatingTag}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {updatingTag ? 'Updating...' : 'Save Tag'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Crew Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="bg-gradient-to-br from-gray-700 to-gray-700/80 rounded-xl p-3 sm:p-4 border border-gray-600">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Members</div>
                  <div className="text-xl sm:text-2xl font-bold text-gray-100">{crewDetails.crew.member_count}/30</div>
                </div>
                <div className="bg-gradient-to-br from-primary-900/30 to-primary-800/20 rounded-xl p-3 sm:p-4 border border-primary-600/30">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Avg Streak</div>
                  <div className="text-xl sm:text-2xl font-bold text-primary-400">{crewDetails.crew.average_streak}</div>
                </div>
                <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 rounded-xl p-3 sm:p-4 border border-yellow-600/30">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Avg Dumbbells</div>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-400">{crewDetails.crew.average_trophies}</div>
                </div>
                <div className="bg-gradient-to-br from-gray-700 to-gray-700/80 rounded-xl p-3 sm:p-4 border border-gray-600">
                  <div className="text-xs sm:text-sm text-gray-400 mb-1">Leader</div>
                  <div className="text-base sm:text-lg font-semibold text-gray-100 truncate">@{crewDetails.crew.leader_username}</div>
                </div>
              </div>

              {/* Pending Requests (Leader Only) */}
              {crewDetails.crew.is_leader && crewDetails.requests.length > 0 && (
                <div className="mb-4 sm:mb-6">
                  <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Pending Requests ({crewDetails.requests.length})</span>
                  </h4>
                  <div className="space-y-2 sm:space-y-3">
                    {crewDetails.requests.map((request) => (
                      <div key={request.id} className="bg-gray-700/80 border border-gray-600 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-100 mb-1">@{request.username}</div>
                          <div className="text-xs sm:text-sm text-gray-400 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                              <Image
                                src="/streakd_dumbbells.png"
                                alt="Dumbbells"
                                width={28}
                                height={16}
                                className="h-4 w-auto"
                                unoptimized
                              />
                              {request.trophies} dumbbells
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-orange-500">🔥</span>
                              {request.current_streak} day streak
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(request.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium text-sm shadow-md"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request.id)}
                            className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors font-medium text-sm shadow-md"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members List */}
              <div>
                <h4 className="text-base sm:text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Members ({crewDetails.members.length})</span>
                </h4>
                <div className="space-y-2 sm:space-y-3">
                  {crewDetails.members.map((member) => (
                    <div key={member.id} className="bg-gray-700/80 border border-gray-600 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4 hover:bg-gray-700 transition-colors">
                      {member.profile_picture && !brokenPics.has(member.user_id) ? (
                        <div className="relative flex-shrink-0">
                          <Image
                            src={getImageUrl(member.profile_picture) || ''}
                            alt={member.username}
                            width={48}
                            height={48}
                            className="rounded-full border-2 border-gray-600"
                            unoptimized
                            onError={() => setBrokenPics((prev) => new Set(prev).add(member.user_id))}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-gray-200 font-bold text-lg border-2 border-gray-600 flex-shrink-0">
                          {member.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-100 truncate">@{member.username}</span>
                          {member.is_leader && (
                            <span className="h-6 px-2 bg-yellow-600/20 border border-yellow-600/50 text-yellow-400 text-xs font-semibold rounded-full flex-shrink-0 inline-flex items-center justify-center leading-none">
                              <span className="leading-none">Leader</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-400 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Image
                              src="/streakd_dumbbells.png"
                              alt="Dumbbells"
                              width={21}
                              height={12}
                              className="h-3 w-auto"
                              unoptimized
                            />
                            <span>{member.trophies.toLocaleString()}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-orange-500">🔥</span>
                            <span>{member.current_streak} day streak</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

