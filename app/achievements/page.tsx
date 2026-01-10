'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAchievementIcon } from '@/components/icons';

interface Achievement {
    id: number;
    key: string;
    name: string;
    description: string;
    icon: string;
    category: 'streak' | 'upload' | 'trophy' | 'social' | 'special';
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    points: number;
    unlocked: boolean;
    unlocked_at?: string;
    progress: number;
}

const CATEGORY_LABELS = {
    streak: 'Streak',
    upload: 'Upload',
    trophy: 'Trophy',
    social: 'Social',
    special: 'Special'
};

const TIER_COLORS = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-cyan-400 to-blue-500'
};

export default function AchievementsPage() {
    const router = useRouter();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [stats, setStats] = useState({ unlocked: 0, total: 0, points: 0 });

    useEffect(() => {
        fetchAchievements();
    }, []);

    const fetchAchievements = async () => {
        try {
            const response = await fetch('/api/achievements');
            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch achievements');
            }

            const data = await response.json();
            setAchievements(data.achievements);

            // Calculate stats
            const unlocked = data.achievements.filter((a: Achievement) => a.unlocked).length;
            const total = data.achievements.length;
            const points = data.achievements
                .filter((a: Achievement) => a.unlocked)
                .reduce((sum: number, a: Achievement) => sum + a.points, 0);

            setStats({ unlocked, total, points });
        } catch (error) {
            console.error('Error fetching achievements:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAchievements = selectedCategory === 'all'
        ? achievements
        : achievements.filter(a => a.category === selectedCategory);

    const categories = ['all', ...Object.keys(CATEGORY_LABELS)] as const;

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading achievements...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between mb-4">
                        <Link href="/dashboard" className="text-gray-400 hover:text-white transition">
                            ← Back to Dashboard
                        </Link>
                    </div>

                    <h1 className="text-4xl font-bold mb-2">Achievements</h1>
                    <p className="text-gray-400">Track your progress and unlock badges</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <div className="text-2xl font-bold text-primary-400">{stats.unlocked}/{stats.total}</div>
                            <div className="text-sm text-gray-400">Unlocked</div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <div className="text-2xl font-bold text-yellow-400">{stats.points}</div>
                            <div className="text-sm text-gray-400">Points</div>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                            <div className="text-2xl font-bold text-green-400">
                                {stats.total > 0 ? Math.round((stats.unlocked / stats.total) * 100) : 0}%
                            </div>
                            <div className="text-sm text-gray-400">Completion</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Filter */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${selectedCategory === category
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {category === 'all' ? 'All' : CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                        </button>
                    ))}
                </div>

                {/* Achievements Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {filteredAchievements.map(achievement => (
                        <div
                            key={achievement.id}
                            className={`relative rounded-lg p-6 border transition-all ${achievement.unlocked
                                ? 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                : 'bg-gray-900 border-gray-800 opacity-60'
                                }`}
                        >
                            {/* Tier Badge */}
                            <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${TIER_COLORS[achievement.tier]}`}>
                                {achievement.tier.toUpperCase()}
                            </div>

                            {/* Icon */}
                            <div className="mb-4">
                                {getAchievementIcon(achievement.icon, { className: 'w-16 h-16 mx-auto', size: 64 })}
                            </div>

                            {/* Name & Description */}
                            <h3 className="text-xl font-bold mb-2">{achievement.name}</h3>
                            <p className="text-gray-400 text-sm mb-4">{achievement.description}</p>

                            {/* Progress Bar (for locked achievements with progress) */}
                            {!achievement.unlocked && achievement.progress > 0 && (
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Progress</span>
                                        <span>{achievement.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-cyan-400 transition-all"
                                            style={{ width: `${achievement.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-yellow-400">+{achievement.points} pts</span>
                                {achievement.unlocked ? (
                                    <span className="text-green-400 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Unlocked
                                    </span>
                                ) : (
                                    <span className="text-gray-500 flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        Locked
                                    </span>
                                )}
                            </div>

                            {/* Unlock Date */}
                            {achievement.unlocked && achievement.unlocked_at && (
                                <div className="text-xs text-gray-500 mt-2">
                                    Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {filteredAchievements.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                        No achievements in this category yet.
                    </div>
                )}
            </div>
        </div>
    );
}
