'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';

interface CrewChatMessage {
  id: number;
  crew_id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: string;
  profile_picture?: string | null;
}

interface CrewChatProps {
  crewId: number;
  currentUserId: number;
  currentUsername: string;
  currentUserProfilePicture?: string | null;
}

export function CrewChat({ crewId, currentUserId, currentUsername, currentUserProfilePicture }: CrewChatProps) {
  const [messages, setMessages] = useState<CrewChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [brokenAvatars, setBrokenAvatars] = useState<Set<number>>(() => new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/crew-chat/messages?crew_id=${crewId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setError('');
      } else {
        setError('Failed to load messages');
      }
    } catch (err) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Belgrade',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
      const clientTime = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;

      const response = await fetch('/api/crew-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage.trim(),
          crew_id: crewId,
          clientTime,
        }),
      });

      const result = await response.json();

      if (response.ok && result.message) {
        setNewMessage('');
        setMessages((prev) => [...prev, result.message]);
        setIsAtBottom(true); // User just sent a message, so scroll to bottom
        // Scroll within chat container only, not the entire page
        if (chatContainerRef.current) {
          const container = chatContainerRef.current;
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
          });
        }
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Track if user is at bottom of chat
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Check scroll position
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const threshold = 100;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      setIsAtBottom(isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll to bottom only if user is at bottom or when sending a message
  useEffect(() => {
    if (isAtBottom && messages.length > 0 && chatContainerRef.current) {
      // Scroll within the chat container only, not the entire page
      const container = chatContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages.length, isAtBottom]); // Only trigger when message count changes

  // Fetch messages on mount and periodically
  useEffect(() => {
    setLoading(true);
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [crewId]);

  const formatTime = (dateString: string) => {
    // SQLite returns datetime as 'YYYY-MM-DD HH:MM:SS' in Serbia timezone
    // Extract time directly from the string to avoid timezone conversion issues
    if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
      // SQLite format: 'YYYY-MM-DD HH:MM:SS' - extract time part directly
      const timePart = dateString.split(' ')[1]; // Get "HH:MM:SS"
      const [hour, minute] = timePart.split(':'); // Get hour and minute
      return `${hour}:${minute}`;
    } else if (dateString.includes('T')) {
      // ISO format: extract time from "YYYY-MM-DDTHH:MM:SS"
      const timePart = dateString.split('T')[1]?.split('.')[0]; // Get "HH:MM:SS"
      if (timePart) {
        const [hour, minute] = timePart.split(':');
        return `${hour}:${minute}`;
      }
    }
    
    // Fallback: try to parse as Date (shouldn't happen with SQLite format)
    try {
      const date = new Date(dateString);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden flex flex-col h-[500px]">
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-750">
        <h3 className="text-lg font-semibold text-gray-100">Crew Chat</h3>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
      >
        {loading && messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">Loading messages...</div>
        ) : error && messages.length === 0 ? (
          <div className="text-center text-red-400 py-8">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
              >
                {!brokenAvatars.has(msg.user_id) ? (
                  <div className="flex-shrink-0">
                    {msg.profile_picture ? (
                      <Image
                        src={getImageUrl(msg.profile_picture) || ''}
                        alt={msg.username}
                        width={40}
                        height={40}
                        className="rounded-full border-2 border-gray-600"
                        unoptimized
                        onError={() => setBrokenAvatars((prev) => new Set(prev).add(msg.user_id))}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                        <span className="text-gray-400 text-sm font-semibold">
                          {msg.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 text-sm font-semibold">
                      {msg.username[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {/* Message Content */}
                <div className={`flex-1 min-w-0 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-center gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs sm:text-sm font-semibold text-gray-300">
                      {msg.username}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(msg.created_at)}</span>
                  </div>
                  <div
                    className={`rounded-lg px-3 sm:px-4 py-2 max-w-[85%] sm:max-w-[75%] break-words ${
                      isOwnMessage
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm sm:text-base whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-gray-700 bg-gray-750">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={sending}
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
      </form>
    </div>
  );
}

