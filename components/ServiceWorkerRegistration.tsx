'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered successfully:', registration.scope);
            
            // Check for updates periodically (every 60 seconds)
            setInterval(() => {
              registration.update();
            }, 60000);

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

