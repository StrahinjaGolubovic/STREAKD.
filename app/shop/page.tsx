'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ShopItem {
  id: number;
  name: string;
  description: string | null;
  price: number;
  item_type: string;
  enabled: number;
}

export default function ShopPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [userCoins, setUserCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchShopData();
  }, []);

  async function fetchShopData() {
    try {
      // Fetch shop items
      const itemsRes = await fetch('/api/shop/items');
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      }

      // Fetch user coins from dashboard
      const dashRes = await fetch('/api/dashboard');
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setUserCoins(dashData.coins || 0);
      } else if (dashRes.status === 401) {
        router.push('/login');
        return;
      }
    } catch (error) {
      console.error('Error fetching shop data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function purchaseItem(itemId: number) {
    setPurchasing(itemId);
    setMessage(null);

    try {
      const res = await fetch('/api/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message || 'Purchase successful!', type: 'success' });
        setUserCoins(data.newBalance);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: data.error || 'Purchase failed', type: 'error' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      setMessage({ text: 'An error occurred', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-primary-400 text-xl">Loading shop...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/dashboard"
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
            <span className="text-yellow-400 text-xl">🪙</span>
            <span className="font-bold text-lg">{userCoins}</span>
            <span className="text-gray-400 text-sm">coins</span>
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
          Shop
        </h1>
        <p className="text-gray-400 mb-8">Purchase items with your coins</p>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-900/50 border border-green-700 text-green-300'
                : 'bg-red-900/50 border border-red-700 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Shop Items */}
        <div className="grid gap-4">
          {items.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              No items available at the moment
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-primary-500 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-primary-400 mb-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-gray-400 mb-4">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 text-lg">🪙</span>
                      <span className="font-bold text-lg">{item.price}</span>
                      <span className="text-gray-400">coins</span>
                    </div>
                  </div>
                  <button
                    onClick={() => purchaseItem(item.id)}
                    disabled={purchasing === item.id || userCoins < item.price}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                      userCoins < item.price
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : purchasing === item.id
                        ? 'bg-primary-600 text-white cursor-wait'
                        : 'bg-primary-500 text-white hover:bg-primary-600'
                    }`}
                  >
                    {purchasing === item.id ? 'Purchasing...' : 'Purchase'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-primary-400 mb-2">
            How to earn coins
          </h3>
          <ul className="text-gray-400 space-y-2">
            <li>• Claim daily coins (75-100 coins per day)</li>
            <li>• Invite friends and get 150 coins when they upload their first verified photo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
