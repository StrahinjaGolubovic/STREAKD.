'use client';

import { useEffect } from 'react';

export function MaintenanceGate() {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        // Don't redirect if you're already on the maintenance page
        if (window.location.pathname.startsWith('/maintenance')) return;

        const res = await fetch('/api/maintenance/status', { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as { maintenance?: boolean; isAdmin?: boolean } | null;
        if (cancelled) return;

        const maintenance = !!json?.maintenance;
        const isAdmin = !!json?.isAdmin;
        if (maintenance && !isAdmin) {
          window.location.replace('/maintenance');
        }
      } catch {
        // Fail-open: do nothing
      }
    }

    check();
    // Also re-check periodically in case maintenance is toggled while users are browsing
    const interval = window.setInterval(check, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}


