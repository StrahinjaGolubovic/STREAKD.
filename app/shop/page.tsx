'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

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
      const itemsRes = await fetch('/api/shop/items');
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.items || []);
      }

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <Link href="/dashboard" className="flex-shrink-0">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={140}
                height={32}
                priority
                className="h-8 sm:h-9 w-auto"
              />
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-900/50 to-amber-900/50 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-yellow-600/40 shadow-lg">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Image
                    src="/streakd_coins.png"
                    alt="Coins"
                    width={20}
                    height={20}
                    unoptimized
                    className="h-4 w-4 sm:h-5 sm:w-5"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-yellow-300/70 font-medium hidden sm:block">Your Balance</span>
                  <span className="font-bold text-base sm:text-lg text-yellow-200 truncate">{userCoins.toLocaleString()}</span>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="p-2 text-gray-400 hover:text-gray-100 active:text-white transition-colors touch-manipulation flex-shrink-0"
                aria-label="Home"
                title="Home"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
            Coin Shop
          </h1>
          <p className="text-gray-400 text-base sm:text-lg px-4">Spend your coins on exclusive items and power-ups</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-900/30 border border-green-700/50 text-green-300'
                : 'bg-red-900/30 border border-red-700/50 text-red-300'
            }`}
          >
            <span className="text-2xl">{message.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        {/* Shop Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {items.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <div className="text-6xl mb-4">🏪</div>
              <p className="text-gray-400 text-lg">No items available at the moment</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="group relative bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300"
              >
                {/* Item Icon/Badge */}
                <div className={`absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${
                  item.item_type === 'rest_day' 
                    ? 'border-2 border-blue-700/30' 
                    : 'bg-gradient-to-br from-primary-500 to-purple-600'
                }`} style={item.item_type === 'rest_day' ? { backgroundColor: '#1f2937' } : {}}>
                  {item.item_type === 'rest_day' ? (
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <span className="text-xl sm:text-2xl">🎁</span>
                  )}
                </div>

                <div className="mb-3 sm:mb-4">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-primary-400 transition-colors">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{item.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <div className="flex items-center gap-1.5 sm:gap-2 bg-yellow-900/30 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-yellow-600/30">
                    <Image
                      src="/streakd_coins.png"
                      alt="Coins"
                      width={20}
                      height={20}
                      unoptimized
                      className="h-4 w-4 sm:h-5 sm:w-5"
                    />
                    <span className="font-bold text-sm sm:text-base text-yellow-200">{item.price}</span>
                  </div>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={() => purchaseItem(item.id)}
                  disabled={purchasing === item.id || userCoins < item.price}
                  className={`w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 touch-manipulation ${
                    userCoins < item.price
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : purchasing === item.id
                      ? 'bg-primary-600 text-white cursor-wait'
                      : 'bg-gradient-to-r from-primary-500 to-purple-600 text-white hover:from-primary-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {purchasing === item.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Purchasing...
                    </span>
                  ) : userCoins < item.price ? (
                    'Not Enough Coins'
                  ) : (
                    'Purchase Now'
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-700/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Image
                  src="/streakd_coins.png"
                  alt="Coins"
                  width={24}
                  height={24}
                  unoptimized
                  className="h-5 w-5 sm:h-6 sm:w-6"
                />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-blue-300">Earn Coins</h3>
            </div>
            <ul className="space-y-2 sm:space-y-3 text-gray-300 text-sm sm:text-base">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Claim <strong className="text-white">75-100 coins</strong> daily from your dashboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>Invite friends and earn <strong className="text-white">150 coins</strong> when they get their first photo verified</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-700/30 rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-purple-300">Pro Tips</h3>
            </div>
            <ul className="space-y-2 sm:space-y-3 text-gray-300 text-sm sm:text-base">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>Save coins for strategic rest day purchases</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>More items coming soon - stay tuned!</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
