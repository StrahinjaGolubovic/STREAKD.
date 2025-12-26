'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import { getTrophyRank, getRankColorStyle } from '@/lib/ranks';

interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  trophies: number;
  profile_picture: string | null;
  crew: { id: number; name: string } | null;
  current_streak: number;
  longest_streak: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-6">Leaderboard</h1>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">User</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-300">Crew</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-300">Trophies</th>
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
                        <span className="text-lg font-bold text-gray-400 w-8">
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
                        {user.profile_picture ? (
                          <Image
                            src={getImageUrl(user.profile_picture) || ''}
                            alt={user.username}
                            width={40}
                            height={40}
                            unoptimized
                            className="w-10 h-10 rounded-full border-2 border-gray-600 object-cover"
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
                        <Link
                          href="/crews"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-600/20 border border-primary-500/50 rounded-md text-primary-300 text-sm font-medium hover:bg-primary-600/30 transition-colors"
                        >
                          <span>👥</span>
                          <span>{user.crew.name}</span>
                        </Link>
                      ) : (
                        <span className="text-gray-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-bold text-yellow-400">{user.trophies.toLocaleString()}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span
                        className="text-sm font-bold"
                        style={getRankColorStyle(user.trophies)}
                      >
                        {getTrophyRank(user.trophies)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <span className="text-sm text-gray-300">
                        🔥 {user.current_streak}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              No users found on the leaderboard yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

