'use client';

import { useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      // Check version on load and force reload if outdated
      const storedVersion = localStorage.getItem('app_version');
      if (storedVersion && storedVersion !== APP_VERSION) {
        console.log(`Version mismatch: stored ${storedVersion}, current ${APP_VERSION}. Clearing cache...`);
        localStorage.setItem('app_version', APP_VERSION);
        
        // Clear all caches
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
        
        // Unregister all service workers and reload
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
          window.location.reload();
        });
        return;
      }
      
      // Set version if not set
      if (!storedVersion) {
        localStorage.setItem('app_version', APP_VERSION);
      }

      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered successfully:', registration.scope);
            
            // Check for updates periodically (every 30 seconds)
            setInterval(() => {
              registration.update();
            }, 30000);

            // Check for updates immediately
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available, reload to update
                    console.log('New service worker available, reloading...');
                    window.location.reload();
                  }
                });
              }
            });

            // Check for updates on page visibility change
            document.addEventListener('visibilitychange', () => {
              if (!document.hidden) {
                registration.update();
              }
            });
          })
          .catch((error) => {
            console.log('Service Worker registration failed:', error);
          });
      });

      // Handle service worker updates
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}

