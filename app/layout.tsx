import type { Metadata, Viewport } from 'next';
import { Inter, Orbitron } from 'next/font/google';
import './globals.css';
import { Footer } from '@/components/Footer';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import { SnowParticles } from '@/components/SnowParticles';

const inter = Inter({ subsets: ['latin'] });
const orbitron = Orbitron({ 
  subsets: ['latin'],
  weight: ['900'], // Black weight
  variable: '--font-orbitron',
});

export const metadata: Metadata = {
  title: {
    default: 'STREAKD.',
    template: '%s · STREAKD.',
  },
  description: 'Stay consistent with your gym routine through streak-based challenges',
  applicationName: 'STREAKD.',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      // Put PNGs first so most desktop browsers don't default to the tiny ICO
      { url: '/favicon-48x48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/android-chrome-192x192.png', type: 'image/png', sizes: '192x192' },
      { url: '/android-chrome-512x512.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: ['/favicon-48x48.png'],
    apple: [{ url: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${orbitron.variable} flex flex-col min-h-screen`}>
        <ServiceWorkerRegistration />
        <MaintenanceGate />
        <SnowParticles />
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}

