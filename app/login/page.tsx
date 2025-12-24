'use client';

/// <reference path="../../types/altcha.d.ts" />

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [altchaSolution, setAltchaSolution] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [altchaReady, setAltchaReady] = useState(false);

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
        // Mark ready on next tick so CSS can reveal the widget cleanly
        requestAnimationFrame(() => setAltchaReady(true));

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
            // The native checkbox can still show a focus/active outline in some browsers.
            // Intercept clicks and trigger ALTCHA verification without focusing the input.
            checkboxInput.addEventListener(
              'click',
              (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                try {
                  (widget as any).verify?.();
                } catch {
                  // ignore
                }
                checkboxInput.blur();
              },
              { capture: true }
            );
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
      {/* altcha.css is loaded globally via app/globals.css */}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-gray-800 border border-gray-700 p-6 sm:p-8 rounded-xl shadow-2xl">
        <div>
          <div className="flex justify-center mb-3">
            <div className="relative h-12 w-12 sm:h-14 sm:w-14">
              <Image
                src="/streakd_logo.png"
                alt="STREAKD."
                fill
                priority
                unoptimized
                className="object-contain"
                sizes="56px"
              />
            </div>
          </div>
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

          <div className="altcha-appear" data-ready={altchaReady ? 'true' : 'false'}>
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
              Don’t have an account?{' '}
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

