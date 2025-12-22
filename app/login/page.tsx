'use client';

/// <reference path="../../types/altcha.d.ts" />

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [altchaSolution, setAltchaSolution] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Check if script is already loaded and element is defined
    const checkDefined = () => {
      if (typeof window !== 'undefined' && (window as any).customElements && (window as any).customElements.get('altcha-widget')) {
        setScriptLoaded(true);
        return true;
      }
      return false;
    };

    if (!checkDefined()) {
      const interval = setInterval(() => {
        if (checkDefined()) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  useEffect(() => {
    if (!scriptLoaded) return;

    const setupWidget = () => {
      const widget = document.querySelector('altcha-widget');
      if (widget) {
        widget.addEventListener('verified', (e: any) => {
          setAltchaSolution(e.detail.payload);
        });
      } else {
        // Retry once if not found immediately
        setTimeout(setupWidget, 100);
      }
    };

    setupWidget();
  }, [scriptLoaded]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!altchaSolution) {
        setError('Please complete the verification challenge');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, altcha: altchaSolution }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Script 
        src="/altcha.js" 
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <link rel="stylesheet" href="/altcha.css" />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-gray-800 border border-gray-700 p-6 sm:p-8 rounded-xl shadow-2xl">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-center text-primary-400 mb-2">Gymble</h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-center text-gray-100">Sign in to your account</h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-gray-700 border border-gray-600 placeholder-gray-400 text-gray-100 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-3 py-2 bg-gray-700 border border-gray-600 placeholder-gray-400 text-gray-100 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Enter your password"
              />
            </div>
          </div>

          <div>
            {scriptLoaded && React.createElement('altcha-widget', {
              challengeurl: '/api/altcha/challenge',
              workerurl: '/worker.js',
              strings: JSON.stringify({
                label: 'Verification',
                error: 'Verification failed. Please try again.',
              }),
              className: 'mb-4',
            })}
            {!scriptLoaded && (
              <div className="mb-4 p-4 bg-gray-700 rounded text-gray-300 text-sm">
                Loading verification...
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-base sm:text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-primary-400 hover:text-primary-300">
                Sign up
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

