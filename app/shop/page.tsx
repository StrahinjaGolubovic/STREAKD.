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

interface Cosmetic {
  id: number;
  name: string;
  description: string | null;
  type: 'avatar_frame' | 'name_color' | 'chat_badge';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  price: number;
  data: any;
  owned: boolean;
  equipped: boolean;
}

export default function ShopPage() {
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
  const [selectedTab, setSelectedTab] = useState<'avatar_frame' | 'name_color' | 'chat_badge'>('avatar_frame');
  const [userCoins, setUserCoins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [equipping, setEquipping] = useState<number | null>(null);
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

      const cosmeticsRes = await fetch('/api/cosmetics/available');
      if (cosmeticsRes.ok) {
        const data = await cosmeticsRes.json();
        setCosmetics(data.cosmetics || []);
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

  async function purchaseCosmetic(cosmeticId: number) {
    setPurchasing(cosmeticId);
    setMessage(null);

    try {
      const res = await fetch('/api/cosmetics/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosmeticId }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message || 'Purchase successful!', type: 'success' });
        setUserCoins(data.newBalance);
        // Refresh cosmetics
        const cosmeticsRes = await fetch('/api/cosmetics/available');
        if (cosmeticsRes.ok) {
          const cosmeticsData = await cosmeticsRes.json();
          setCosmetics(cosmeticsData.cosmetics || []);
        }
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

  async function equipCosmetic(cosmeticId: number) {
    setEquipping(cosmeticId);

    try {
      const res = await fetch('/api/cosmetics/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cosmeticId }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message || 'Equipped successfully!', type: 'success' });
        // Refresh cosmetics
        const cosmeticsRes = await fetch('/api/cosmetics/available');
        if (cosmeticsRes.ok) {
          const cosmeticsData = await cosmeticsRes.json();
          setCosmetics(cosmeticsData.cosmetics || []);
        }
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ text: data.error || 'Equip failed', type: 'error' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Equip error:', error);
      setMessage({ text: 'An error occurred', type: 'error' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setEquipping(null);
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
          <div className="flex items-center justify-between gap-2 min-h-[44px] sm:min-h-[48px]">
            <Link href="/dashboard" className="flex-shrink-0">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                width={1080}
                height={200}
                priority
                className="h-9 sm:h-10 md:h-12 w-auto"
                style={{ objectFit: 'contain' }}
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
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            SHOP
          </h1>
          <p className="text-gray-400 text-base sm:text-lg px-4">Spend your coins on exclusive items and power-ups</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success'
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
          {/* Premium Subscription Card - Featured */}
          <div className="md:col-span-2 lg:col-span-3 relative group">
            {/* Sale Badge */}
            <div className="absolute -top-2 -left-2 sm:-top-4 sm:-left-4 z-10">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur-md opacity-75 animate-pulse"></div>
                <div className="relative bg-gradient-to-r from-red-600 to-pink-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-bold text-xs sm:text-sm md:text-base shadow-xl border-2 border-red-400">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1 sm:mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 01-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                  50% OFF
                </div>
              </div>
            </div>

            <div className="relative bg-gradient-to-br from-primary-900/60 to-primary-800/60 border-2 border-primary-500/70 rounded-xl sm:rounded-2xl md:rounded-3xl p-5 sm:p-6 md:p-8 overflow-hidden hover:border-primary-400/90 hover:shadow-2xl transition-all duration-300"
              style={{
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.15)',
              }}
            >
              {/* Shimmer glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-400/10 to-transparent animate-shimmer-glow"></div>

              <div className="relative flex flex-col sm:flex-row items-center sm:items-center gap-5 sm:gap-6 md:gap-8">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center shadow-2xl border-4 border-primary-400/30 group-hover:scale-110 transition-transform duration-300">
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-primary-100" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 text-center sm:text-left w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-2 mb-3">
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-primary-200 tracking-wider uppercase leading-none" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      PREMIUM
                    </h3>
                    <span className="px-2.5 py-1 sm:px-3 sm:py-1 bg-primary-500/20 border border-primary-500/40 rounded-md text-xs sm:text-xs font-bold text-primary-300 uppercase tracking-wider">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-gray-300 text-xs sm:text-sm md:text-base mb-4 sm:mb-5 leading-relaxed px-2 sm:px-0">
                    Unlock exclusive features, custom profile colors, special badges, and more premium perks!
                  </p>

                  {/* Features list */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-2 mb-5 sm:mb-4">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 justify-center sm:justify-start">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Custom username colors</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 justify-center sm:justify-start">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Exclusive avatar frames</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 justify-center sm:justify-start">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Premium badge</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-300 justify-center sm:justify-start">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Priority support</span>
                    </div>
                  </div>
                </div>

                {/* Pricing & CTA */}
                <div className="flex-shrink-0 flex flex-col items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  {/* Price */}
                  <div className="text-center">
                    <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-1">
                      <span className="text-base sm:text-lg md:text-xl font-semibold text-gray-500 line-through" style={{ fontFamily: 'Orbitron, sans-serif' }}>$5.00</span>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex items-baseline gap-1 justify-center">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-black text-primary-200" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                        $2.50
                      </span>
                      <span className="text-xs sm:text-sm text-gray-400">/month</span>
                    </div>
                    <div className="flex items-center gap-1 justify-center mt-1">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-xs text-green-400 font-semibold">Save 50%</p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => {
                      alert('Premium subscriptions are not yet available for purchase.\n\nWe\'re working hard to bring you premium features soon!\n\nStay tuned for updates!');
                    }}
                    className="relative group/btn w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white font-black text-sm sm:text-base md:text-lg rounded-xl shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 hover:scale-105 active:scale-95 border-2 border-primary-400/50 touch-manipulation"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      GET PREMIUM
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-300 to-primary-500 rounded-xl opacity-0 group-hover/btn:opacity-20 transition-opacity duration-300"></div>
                  </button>
                </div>
              </div>

              {/* Shimmer animation styles */}
              <style jsx>{`
                @keyframes shimmer-glow {
                  0% { 
                    transform: translateX(-100%); 
                    opacity: 0;
                  }
                  50% {
                    opacity: 0.3;
                  }
                  100% { 
                    transform: translateX(100%); 
                    opacity: 0;
                  }
                }
                .animate-shimmer-glow { 
                  animation: shimmer-glow 3s infinite;
                  width: 100%;
                }
              `}</style>
            </div>
          </div>

          {/* Regular Shop Items */}
          {items.length === 0 ? (
            <div className="col-span-full text-center py-16">
              <svg className="w-24 h-24 mx-auto mb-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-400 text-lg">No items available at the moment</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="group relative bg-gradient-to-br from-gray-800 to-gray-800/50 border border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300"
              >
                {/* Item Icon/Badge */}
                <div className={`absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${item.item_type === 'rest_day'
                  ? 'border-2 border-blue-700/30'
                  : 'bg-gradient-to-br from-primary-500 to-purple-600'
                  }`} style={item.item_type === 'rest_day' ? { backgroundColor: 'rgba(30, 58, 138, 0.5)' } : {}}>
                  {item.item_type === 'rest_day' ? (
                    <svg className="w-7 h-7 sm:w-8 sm:h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
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
                  className={`w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 touch-manipulation ${userCoins < item.price
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

        {/* Cosmetics Section */}
        <div className="mb-8 sm:mb-12">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              COSMETICS
            </h2>
            <p className="text-gray-400 text-sm sm:text-base px-4">Customize your profile with exclusive items</p>
          </div>

          {/* Compact Horizontal Tabs */}
          <div className="flex gap-2 sm:gap-3 mb-6 justify-center">
            <button
              onClick={() => setSelectedTab('avatar_frame')}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all touch-manipulation ${selectedTab === 'avatar_frame'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                }`}
            >
              🖼️ Frames
            </button>
            <button
              onClick={() => setSelectedTab('name_color')}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all touch-manipulation ${selectedTab === 'name_color'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                }`}
            >
              🎨 Colors
            </button>
            <button
              onClick={() => setSelectedTab('chat_badge')}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all touch-manipulation ${selectedTab === 'chat_badge'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                }`}
            >
              🏅 Badges
            </button>
          </div>

          {/* Cosmetics Grid - Matching Shop Items Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cosmetics
              .filter(c => c.type === selectedTab)
              .map((cosmetic) => {
                const rarityColors = {
                  common: { border: 'border-gray-600', badge: 'bg-gray-600', text: 'text-gray-300' },
                  rare: { border: 'border-blue-500', badge: 'bg-blue-500', text: 'text-blue-300' },
                  epic: { border: 'border-purple-500', badge: 'bg-purple-500', text: 'text-purple-300' },
                  legendary: { border: 'border-yellow-500', badge: 'bg-yellow-500', text: 'text-yellow-300' }
                };
                const rarity = rarityColors[cosmetic.rarity];

                return (
                  <div
                    key={cosmetic.id}
                    className={`group relative bg-gradient-to-br from-gray-800 to-gray-800/50 border ${cosmetic.equipped ? rarity.border : 'border-gray-700'
                      } rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-primary-500/50 hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-300`}
                  >
                    {/* Rarity Badge - Top Right */}
                    <div className={`absolute -top-3 -right-3 sm:-top-4 sm:-right-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full ${rarity.badge} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform border-2 border-gray-900`}>
                      <span className="text-white text-xs sm:text-sm font-bold uppercase">{cosmetic.rarity[0]}</span>
                    </div>

                    {/* Equipped Indicator */}
                    {cosmetic.equipped && (
                      <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
                        <div className="flex items-center gap-1.5 bg-green-600/20 text-green-400 border border-green-500/50 rounded-full px-2 py-0.5 text-xs font-semibold">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Equipped
                        </div>
                      </div>
                    )}

                    {/* Preview Area */}
                    <div className="mb-4 flex items-center justify-center h-20 sm:h-24 mt-2">
                      {cosmetic.type === 'avatar_frame' && (
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center"
                          style={cosmetic.data.gradient ? {
                            background: cosmetic.data.gradient,
                            padding: `${cosmetic.data.borderWidth || 3}px`
                          } : {
                            border: `${cosmetic.data.borderWidth || 3}px ${cosmetic.data.borderStyle || 'solid'} ${cosmetic.data.borderColor}`,
                          }}
                        >
                          <div className="w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-xl">
                            👤
                          </div>
                        </div>
                      )}
                      {cosmetic.type === 'name_color' && (
                        <div
                          className="text-xl sm:text-2xl font-bold"
                          style={cosmetic.data.gradient ? {
                            background: cosmetic.data.gradient,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text'
                          } : {
                            color: cosmetic.data.color
                          }}
                        >
                          {cosmetic.name.split(' ')[0]}
                        </div>
                      )}
                      {cosmetic.type === 'chat_badge' && (
                        <div className="text-3xl sm:text-4xl">
                          {cosmetic.data.icon}
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <div className="mb-3 sm:mb-4">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1.5 sm:mb-2 group-hover:text-primary-400 transition-colors">
                        {cosmetic.name}
                      </h3>
                      {cosmetic.description && (
                        <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">{cosmetic.description}</p>
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
                        <span className="font-bold text-sm sm:text-base text-yellow-200">{cosmetic.price}</span>
                      </div>
                    </div>

                    {/* Action Button */}
                    {cosmetic.owned ? (
                      cosmetic.equipped ? (
                        <div className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base bg-green-600/20 text-green-400 border border-green-500/50 text-center">
                          ✓ Equipped
                        </div>
                      ) : (
                        <button
                          onClick={() => equipCosmetic(cosmetic.id)}
                          disabled={equipping === cosmetic.id}
                          className="w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:from-blue-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all duration-200 touch-manipulation disabled:opacity-50"
                        >
                          {equipping === cosmetic.id ? 'Equipping...' : 'Equip'}
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => purchaseCosmetic(cosmetic.id)}
                        disabled={purchasing === cosmetic.id || userCoins < cosmetic.price}
                        className={`w-full py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 touch-manipulation ${userCoins < cosmetic.price
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : purchasing === cosmetic.id
                              ? 'bg-primary-600 text-white cursor-wait'
                              : 'bg-gradient-to-r from-primary-500 to-purple-600 text-white hover:from-primary-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                          }`}
                      >
                        {purchasing === cosmetic.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Purchasing...
                          </span>
                        ) : userCoins < cosmetic.price ? (
                          'Not Enough Coins'
                        ) : (
                          'Purchase Now'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Empty State */}
          {cosmetics.filter(c => c.type === selectedTab).length === 0 && (
            <div className="col-span-full text-center py-16">
              <svg className="w-24 h-24 mx-auto mb-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <p className="text-gray-400 text-lg">No cosmetics available in this category yet</p>
            </div>
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
    </div >
  );
}
