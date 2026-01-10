'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
    id: number;
    username: string;
    is_premium: number;
    premium_granted_at: string | null;
    created_at: string;
    username_color: string | null;
}

export default function AdminPremiumPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [premiumUsers, setPremiumUsers] = useState<User[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [message, setMessage] = useState('');

    const fetchUsers = useCallback(async (query = '') => {
        setLoading(true);
        try {
            const url = `/api/admin/premium/users${query ? `?search=${encodeURIComponent(query)}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();

            if (res.ok) {
                setUsers(data.users);
                setPremiumUsers(data.premiumUsers);
            } else {
                setMessage(data.error || 'Failed to fetch users');
                if (res.status === 403) {
                    setTimeout(() => router.push('/dashboard'), 2000);
                }
            }
        } catch (error) {
            setMessage('Error loading users');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    async function handleGrantPremium(userId: number) {
        setActionLoading(userId);
        try {
            const res = await fetch('/api/admin/premium/grant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage(`Premium granted successfully!`);
                fetchUsers(search);
            } else {
                setMessage(data.error || 'Failed to grant premium');
            }
        } catch (error) {
            setMessage('Error granting premium');
        } finally {
            setActionLoading(null);
        }
    }

    async function handleRevokePremium(userId: number) {
        setActionLoading(userId);
        try {
            const res = await fetch('/api/admin/premium/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            const data = await res.json();
            if (res.ok) {
                setMessage(`Premium revoked successfully!`);
                fetchUsers(search);
            } else {
                setMessage(data.error || 'Failed to revoke premium');
            }
        } catch (error) {
            setMessage('Error revoking premium');
        } finally {
            setActionLoading(null);
        }
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        fetchUsers(search);
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
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-3 md:py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-primary-400">Admin Dashboard</h1>
                    <div className="flex gap-2">
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
                            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors text-sm sm:text-base"
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
                        <Link
                            href="/admin/premium"
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm sm:text-base"
                        >
                            Premium
                        </Link>
                    </nav>
                </div>

                {/* Message */}
                {message && (
                    <div className="mb-6 p-4 bg-primary-900/30 border border-primary-700/50 rounded-lg">
                        <p className="text-primary-300">{message}</p>
                    </div>
                )}

                {/* Premium Users List */}
                <div className="mb-6 sm:mb-8 bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mb-4 sm:mb-6 flex items-center gap-2">
                        <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477l-3.763 1.105 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                        </svg>
                        Premium Users ({premiumUsers.length})
                    </h2>
                    {premiumUsers.length === 0 ? (
                        <p className="text-gray-400">No premium users yet</p>
                    ) : (
                        <div className="space-y-2">
                            {premiumUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
                                    <div>
                                        <span className="font-semibold text-purple-300 text-sm sm:text-base">@{user.username}</span>
                                        <span className="text-xs sm:text-sm text-gray-400 ml-2">ID: {user.id}</span>
                                    </div>
                                    <button
                                        onClick={() => handleRevokePremium(user.id)}
                                        disabled={actionLoading === user.id}
                                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    >
                                        {actionLoading === user.id ? 'Revoking...' : 'Revoke'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* User Search & Grant */}
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 sm:p-5 md:p-6">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-100 mb-4 sm:mb-6">Grant Premium to User</h2>

                    <form onSubmit={handleSearch} className="mb-6">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by username..."
                                className="flex-1 px-3 sm:px-4 py-2 bg-gray-700 border border-gray-600 text-sm sm:text-base rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                                type="submit"
                                className="px-4 sm:px-6 py-2 bg-primary-600 text-white text-sm sm:text-base rounded-md hover:bg-primary-700 transition-colors"
                            >
                                Search
                            </button>
                        </div>
                    </form>

                    <div className="space-y-2">
                        {users.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">No users found. Try searching for a username.</p>
                        ) : (
                            users.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
                                    <div>
                                        <span className="font-semibold text-gray-100 text-sm sm:text-base">@{user.username}</span>
                                        <span className="text-xs sm:text-sm text-gray-400 ml-2">ID: {user.id}</span>
                                        {user.is_premium === 1 && (
                                            <span className="ml-2 text-xs bg-purple-600/30 text-purple-300 px-2 py-0.5 rounded-full">
                                                PREMIUM
                                            </span>
                                        )}
                                    </div>
                                    {user.is_premium === 0 && (
                                        <button
                                            onClick={() => handleGrantPremium(user.id)}
                                            disabled={actionLoading === user.id}
                                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                                        >
                                            {actionLoading === user.id ? 'Granting...' : 'Grant Premium'}
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
