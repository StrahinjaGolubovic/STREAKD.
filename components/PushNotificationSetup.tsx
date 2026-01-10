'use client';

import { useEffect, useState } from 'react';

interface PushNotificationSetupProps {
    onSubscribed?: () => void;
}

export default function PushNotificationSetup({ onSubscribed }: PushNotificationSetupProps) {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        checkNotificationStatus();
    }, []);

    const checkNotificationStatus = async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            return;
        }

        setPermission(Notification.permission);

        // Check if already subscribed
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);

            // Show prompt if not subscribed and permission not denied
            if (!subscription && Notification.permission !== 'denied') {
                setShowPrompt(true);
            }
        } catch (err) {
            console.error('Error checking subscription:', err);
        }
    };

    const requestPermission = async () => {
        setLoading(true);
        setError(null);

        try {
            // Request notification permission
            const permission = await Notification.requestPermission();
            setPermission(permission);

            if (permission !== 'granted') {
                setError('Notification permission denied');
                setLoading(false);
                return;
            }

            // Get VAPID public key
            const keyResponse = await fetch('/api/push/vapid-public-key');
            if (!keyResponse.ok) {
                throw new Error('Failed to get VAPID key');
            }
            const { publicKey } = await keyResponse.json();

            // Subscribe to push notifications
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
            });

            // Send subscription to server
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() })
            });

            if (!response.ok) {
                throw new Error('Failed to save subscription');
            }

            setIsSubscribed(true);
            setShowPrompt(false);
            onSubscribed?.();

            // Show success notification
            new Notification('Notifications Enabled!', {
                body: "You'll now receive daily reminders to upload your workout photos.",
                icon: '/android-chrome-192x192.png'
            });
        } catch (err: any) {
            console.error('Error subscribing to push:', err);
            setError(err.message || 'Failed to enable notifications');
        } finally {
            setLoading(false);
        }
    };

    const sendTestNotification = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/push/test', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to send test notification');
            }

            const data = await response.json();
            if (data.sent > 0) {
                alert('Test notification sent! Check your notifications.');
            } else {
                alert('No devices to send to. Make sure you\'re subscribed.');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Don't show if browser doesn't support notifications
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return null;
    }

    // Don't show if permission denied
    if (permission === 'denied') {
        return null;
    }

    // Don't show if already subscribed and not showing prompt
    if (isSubscribed && !showPrompt) {
        return null;
    }

    return (
        <div className="bg-gradient-to-r from-primary-500/10 to-cyan-500/10 border border-primary-500/30 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-500/20">
                    <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                        {isSubscribed ? 'Notifications Enabled' : 'Enable Push Notifications'}
                    </h3>
                    <p className="text-gray-300 mb-4">
                        {isSubscribed
                            ? "You're all set! You'll receive daily reminders to upload your workout photos."
                            : "Get reminded throughout the day to upload your workout photo. Never miss a day!"}
                    </p>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3">
                        {!isSubscribed ? (
                            <button
                                onClick={requestPermission}
                                disabled={loading}
                                className="bg-gradient-to-r from-primary-500 to-cyan-500 hover:from-primary-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-all"
                            >
                                {loading ? 'Enabling...' : 'Enable Notifications'}
                            </button>
                        ) : (
                            <button
                                onClick={sendTestNotification}
                                disabled={loading}
                                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-all"
                            >
                                {loading ? 'Sending...' : 'Send Test Notification'}
                            </button>
                        )}

                        {showPrompt && (
                            <button
                                onClick={() => setShowPrompt(false)}
                                className="text-gray-400 hover:text-white transition"
                            >
                                Maybe Later
                            </button>
                        )}
                    </div>

                    {isSubscribed && (
                        <p className="text-xs text-gray-500 mt-3">
                            Tip: You can manage notification preferences in settings
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
