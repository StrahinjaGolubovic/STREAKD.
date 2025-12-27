'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import { getTrophyRank, getRankColorStyle, getRankBorderStyle } from '@/lib/ranks';

interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  trophies: number;
  profile_picture: string | null;
  crew: { id: number; name: string; tag: string | null; tag_color: string } | null;
  current_streak: number;
  longest_streak: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [brokenPics, setBrokenPics] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    try {
      setLoading(true);
      const response = await fetch('/api/leaderboard?limit=100');
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard);
      } else {
        setError('Failed to load leaderboard');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400">{error}</div>
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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 sm:p-6 md:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-4 sm:mb-6">Leaderboard</h1>
          
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {leaderboard.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${encodeURIComponent(user.username)}`}
                className="block bg-gray-700/50 border border-gray-600 rounded-xl p-4 hover:bg-gray-700 transition-colors active:bg-gray-600"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-shrink-0 w-10 flex items-center justify-center">
                    {user.rank <= 3 ? (
                      <span className="text-2xl">
                        {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : '🥉'}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-gray-400">
                        #{user.rank}
                      </span>
                    )}
                  </div>
                  {user.profile_picture && !brokenPics.has(user.id) ? (
                    <Image
                      src={getImageUrl(user.profile_picture) || ''}
                      alt={user.username}
                      width={48}
                      height={48}
                      unoptimized
                      className="w-12 h-12 rounded-full border-2 border-gray-600 object-cover flex-shrink-0"
                      onError={() => setBrokenPics((prev) => new Set(prev).add(user.id))}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-400 font-semibold text-lg">
                        {user.username[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-gray-100 truncate">@{user.username}</div>
                      {user.crew && user.crew.tag && (
                        <Link
                          href="/crews"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold border flex-shrink-0"
                          style={{
                            backgroundColor: `${user.crew.tag_color}20`,
                            borderColor: user.crew.tag_color,
                            color: user.crew.tag_color,
                          }}
                        >
                          {user.crew.tag}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-600">
                  {/* Dumbbells - Far Left */}
                  <div className="flex items-center gap-1.5">
                    <Image
                      src="/streakd_dumbbells.png"
                      alt="Dumbbells"
                      width={43}
                      height={24}
                      className="h-6 w-auto"
                      unoptimized
                    />
                    <span className="font-bold text-yellow-400 text-base">{user.trophies.toLocaleString()}</span>
                  </div>
                  
                  {/* Streak - Middle */}
                  <div className="flex items-center gap-1">
                    <span className="text-orange-500">🔥</span>
                    <span className="text-sm font-semibold text-orange-400">{user.current_streak}</span>
                  </div>
                  
                  {/* Rank - Far Right */}
                  <div className="bg-gray-900 px-3 py-1.5 rounded-full border-2 shadow-lg" style={getRankBorderStyle(user.trophies)}>
                    <span className="text-xs font-bold rank-shine" style={{ ...getRankColorStyle(user.trophies), fontFamily: 'var(--font-orbitron), sans-serif' }}>
                      {getTrophyRank(user.trophies)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            
            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No users found on the leaderboard yet.
              </div>
            )}
          </div>

          {/* Desktop Table Layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Crew</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Dumbbells</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Rank</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Streak</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-400 w-8 flex items-center justify-center">
                          {user.rank <= 3 ? (
                            <span className="text-2xl">
                              {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            `#${user.rank}`
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Link
                        href={`/profile/${encodeURIComponent(user.username)}`}
                        className="flex items-center gap-3 hover:text-primary-400 transition-colors"
                      >
                        {user.profile_picture && !brokenPics.has(user.id) ? (
                          <Image
                            src={getImageUrl(user.profile_picture) || ''}
                            alt={user.username}
                            width={40}
                            height={40}
                            unoptimized
                            className="w-10 h-10 rounded-full border-2 border-gray-600 object-cover"
                            onError={() => setBrokenPics((prev) => new Set(prev).add(user.id))}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                            <span className="text-gray-400 font-semibold">
                              {user.username[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="font-medium text-gray-100">{user.username}</span>
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      {user.crew ? (
                        user.crew.tag ? (
                          <Link
                            href="/crews"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold border-2 hover:opacity-80 transition-opacity"
                            style={{
                              backgroundColor: `${user.crew.tag_color}20`,
                              borderColor: user.crew.tag_color,
                              color: user.crew.tag_color,
                            }}
                          >
                            <span>{user.crew.tag}</span>
                          </Link>
                        ) : (
                          <Link
                            href="/crews"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-600/20 border border-primary-500/50 rounded-md text-primary-300 text-sm font-medium hover:bg-primary-600/30 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span>{user.crew.name}</span>
                          </Link>
                        )
                      ) : (
                        <span className="text-gray-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Image
                          src="/streakd_dumbbells.png"
                          alt="Dumbbells"
                          width={43}
                          height={24}
                          className="h-6 w-auto"
                          unoptimized
                        />
                        <span className="font-bold text-yellow-400">{user.trophies.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex bg-gray-900 px-3 py-1.5 rounded-full border-2 shadow-lg" style={getRankBorderStyle(user.trophies)}>
                        <span className="text-xs font-bold rank-shine" style={{ ...getRankColorStyle(user.trophies), fontFamily: 'var(--font-orbitron), sans-serif' }}>
                          {getTrophyRank(user.trophies)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-orange-500">🔥</span>
                      <span className="text-sm font-semibold text-orange-400">{user.current_streak}</span>
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {leaderboard.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                No users found on the leaderboard yet.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

