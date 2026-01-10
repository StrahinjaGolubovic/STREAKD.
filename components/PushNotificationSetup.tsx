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
    const [checking, setChecking] = useState(true); // Add checking state

    useEffect(() => {
        checkNotificationStatus();
    }, []);

    const checkNotificationStatus = async () => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setChecking(false);
            return;
        }

        setPermission(Notification.permission);

        // Check if already subscribed
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Check if this subscription is linked to the current user
                const checkResponse = await fetch('/api/push/check-subscription', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscription: subscription.toJSON() })
                });

                if (checkResponse.ok) {
                    const { isLinkedToCurrentUser } = await checkResponse.json();

                    if (isLinkedToCurrentUser) {
                        // Subscription exists and is linked to current user
                        setIsSubscribed(true);
                    } else {
                        // Subscription exists but is linked to different user
                        // Re-subscribe to link to current user
                        setIsSubscribed(false);
                        setShowPrompt(true);
                    }
                } else {
                    // Can't verify, assume not subscribed
                    setIsSubscribed(false);
                    if (Notification.permission !== 'denied') {
                        setShowPrompt(true);
                    }
                }
            } else {
                // No subscription at all
                setIsSubscribed(false);
                if (Notification.permission !== 'denied') {
                    setShowPrompt(true);
                }
            }
        } catch (err) {
            console.error('Error checking subscription:', err);
        } finally {
            setChecking(false); // Always set checking to false when done
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

    // Don't show while checking
    if (checking) {
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
        <div className="bg-gradient-to-r from-primary-500/10 to-cyan-500/10 border border-primary-500/30 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-500/20 flex-shrink-0">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </div>
                <div className="flex-1 w-full">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">
                        {isSubscribed ? 'Notifications Enabled' : 'Enable Push Notifications'}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-300 mb-3 sm:mb-4">
                        {isSubscribed
                            ? "You're all set! You'll receive daily reminders to upload your workout photos."
                            : "Get reminded throughout the day to upload your workout photo. Never miss a day!"}
                    </p>

                    {error && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 text-red-300 text-xs sm:text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        {!isSubscribed ? (
                            <button
                                onClick={requestPermission}
                                disabled={loading}
                                className="w-full sm:w-auto bg-gradient-to-r from-primary-500 to-cyan-500 hover:from-primary-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 sm:py-2 px-6 rounded-lg transition-all text-sm sm:text-base"
                            >
                                {loading ? 'Enabling...' : 'Enable Notifications'}
                            </button>
                        ) : (
                            <button
                                onClick={sendTestNotification}
                                disabled={loading}
                                className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 sm:py-2 px-6 rounded-lg transition-all text-sm sm:text-base"
                            >
                                {loading ? 'Sending...' : 'Send Test Notification'}
                            </button>
                        )}

                        {showPrompt && (
                            <button
                                onClick={() => setShowPrompt(false)}
                                className="w-full sm:w-auto text-gray-400 hover:text-white transition py-2 text-sm sm:text-base"
                            >
                                Maybe Later
                            </button>
                        )}
                    </div>

                    {isSubscribed && (
                        <p className="text-xs text-gray-500 mt-2 sm:mt-3">
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
