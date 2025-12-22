'use client';

/// <reference path="../../types/altcha.d.ts" />

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

        // Remove focus state (ALTCHA applies a focus-within border around the checkbox/container)
        // We blur the internal checkbox input whenever it receives focus.
        try {
          const shadowRoot = (widget as any).shadowRoot as ShadowRoot | null;
          const checkboxInput = shadowRoot?.querySelector('.altcha-checkbox input') as HTMLInputElement | null;
          if (checkboxInput) {
            // Kill the browser's default checkbox focus outline (the white rounded square)
            checkboxInput.style.outline = 'none';
            checkboxInput.style.boxShadow = 'none';
            // Extra: prevent it from receiving focus on click/tap
            checkboxInput.tabIndex = -1;
            checkboxInput.addEventListener('focus', () => checkboxInput.blur());
            checkboxInput.addEventListener('mousedown', (ev) => ev.preventDefault());
            checkboxInput.addEventListener('pointerdown', (ev) => ev.preventDefault());
          }
        } catch {
          // Ignore if shadow root is not accessible
        }
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

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      if (!altchaSolution) {
        setError('Please complete the verification challenge');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, altcha: altchaSolution }),
      });

      const data = await response.json();

      if (response.ok) {
        // Auto-login after registration
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        if (loginResponse.ok) {
          router.push('/dashboard');
          router.refresh();
        } else {
          router.push('/login');
        }
      } else {
        setError(data.error || 'Registration failed');
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
          <h2 className="text-xl sm:text-2xl font-semibold text-center text-gray-100">Create your account</h2>
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
                className="mt-1 appearance-none relative block w-full px-4 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 text-base sm:text-sm min-h-[44px]"
                placeholder="Choose a username"
              />
              <p className="mt-1 text-xs text-gray-400">3+ characters, letters, numbers, and underscores only</p>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-4 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 text-base sm:text-sm min-h-[44px]"
                placeholder="Enter your password"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 appearance-none relative block w-full px-4 py-3 bg-gray-700 border border-gray-600 placeholder-gray-400 text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:z-10 text-base sm:text-sm min-h-[44px]"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          <div>
            {scriptLoaded && React.createElement('altcha-widget', {
              challengeurl: '/api/altcha/challenge',
              workerurl: '/worker.js',
              theme: 'dark',
              hidelogo: true,
              hidefooter: true,
              disableautofocus: true,
              strings: JSON.stringify({
                label: 'Verification',
                error: 'Verification failed. Please try again.',
              }),
            })}
            {!scriptLoaded && (
              <div className="mb-4 p-4 bg-gray-700 border border-gray-600 rounded text-gray-300 text-sm">
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
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary-400 hover:text-primary-300">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

