'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { formatDateDisplay, formatDateTimeDisplay } from '@/lib/timezone';

interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_user_id?: number | null;
  related_crew_id?: number | null;
  read: boolean;
  created_at: string;
}

interface NotificationsProps {
  userId: number;
}

export function Notifications({ userId }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notificationId }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const clearAll = async () => {
    try {
      const response = await fetch('/api/notifications', { method: 'DELETE' });
      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = notificationsRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const getNotificationLink = (notification: Notification): string | null => {
    if (notification.type === 'nudge' && notification.related_user_id) {
      // For nudge notifications, we'd need to get the username
      // For now, just return null or profile link
      return null;
    }
    if (notification.related_crew_id) {
      return `/crews`;
    }
    return null;
  };

  return (
    <div className="relative" ref={notificationsRef}>
      <button
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          // Auto-mark as read when opening the dropdown
          if (nextOpen && unreadCount > 0) {
            markAllAsRead();
          }
        }}
        className="relative p-2 text-gray-400 hover:text-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed top-16 left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 mt-2 sm:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-[500px] flex flex-col">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-100 text-right flex-1">Notifications</h3>
            <div className="flex items-center gap-3 ml-2">
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-300 hover:text-gray-100"
                >
                  Clear
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-primary-400 hover:text-primary-300"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-4 text-center text-gray-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-400">No notifications</div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notification) => {
                    const link = getNotificationLink(notification);
                    const content = (
                      <div
                        className={`p-4 hover:bg-gray-700 transition-colors cursor-pointer ${
                          !notification.read ? 'bg-gray-750' : ''
                        }`}
                        onClick={() => {
                          if (!notification.read) {
                            markAsRead(notification.id);
                          }
                          if (link) {
                            window.location.href = link;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3 justify-end">
                          <div className="flex-1 min-w-0 text-right">
                            <div className="font-semibold text-gray-100 text-sm">{notification.title}</div>
                            <div className="text-gray-300 text-sm mt-1">{notification.message}</div>
                            <div className="text-xs text-gray-500 mt-2">
                              {formatDateTimeDisplay(notification.created_at)}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary-400 rounded-full mt-2 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );

                    return link ? (
                      <Link key={notification.id} href={link}>
                        {content}
                      </Link>
                    ) : (
                      <div key={notification.id}>{content}</div>
                    );
                  })}
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
}

