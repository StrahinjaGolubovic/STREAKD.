'use client';

import { useState, useEffect } from 'react';
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

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers(query = '') {
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
    }

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

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="text-primary-400 hover:text-primary-300">
                            ← Back to Dashboard
                        </Link>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Premium Management
                        </h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Message */}
                {message && (
                    <div className="mb-6 p-4 bg-primary-900/30 border border-primary-700/50 rounded-lg">
                        <p className="text-primary-300">{message}</p>
                    </div>
                )}

                {/* Premium Users List */}
                <div className="mb-8 bg-gray-800 border border-purple-700/50 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L10 6.477l-3.763 1.105 1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                        </svg>
                        Premium Users ({premiumUsers.length})
                    </h2>
                    {premiumUsers.length === 0 ? (
                        <p className="text-gray-400">No premium users yet</p>
                    ) : (
                        <div className="space-y-2">
                            {premiumUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                                    <div>
                                        <span className="font-bold text-purple-300">@{user.username}</span>
                                        <span className="text-sm text-gray-400 ml-2">ID: {user.id}</span>
                                    </div>
                                    <button
                                        onClick={() => handleRevokePremium(user.id)}
                                        disabled={actionLoading === user.id}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                    >
                                        {actionLoading === user.id ? 'Revoking...' : 'Revoke'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* User Search & Grant */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-gray-100 mb-4">Grant Premium to User</h2>

                    <form onSubmit={handleSearch} className="mb-6">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by username..."
                                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <button
                                type="submit"
                                className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                            >
                                Search
                            </button>
                        </div>
                    </form>

                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400 mx-auto"></div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {users.length === 0 ? (
                                <p className="text-gray-400 text-center py-4">No users found</p>
                            ) : (
                                users.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                                        <div>
                                            <span className="font-bold">@{user.username}</span>
                                            <span className="text-sm text-gray-400 ml-2">ID: {user.id}</span>
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
                                                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                                            >
                                                {actionLoading === user.id ? 'Granting...' : 'Grant Premium'}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
