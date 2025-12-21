'use client';

import { useEffect, useState, useRef } from 'react';
import { getImageUrl } from '@/lib/image-utils';

interface ChatMessage {
  id: number;
  user_id: number;
  username: string;
  message: string;
  created_at: string;
  profile_picture?: string | null;
}

interface ChatProps {
  currentUserId: number;
  currentUsername: string;
  currentUserProfilePicture?: string | null;
}

export function Chat({ currentUserId, currentUsername, currentUserProfilePicture }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/chat/messages');
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
    e.stopPropagation(); // Prevent form from causing page scroll
    
    if (!newMessage.trim() || sending) return;

    setSending(true);
    setError('');

    try {
      // Get current time in user's local timezone
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const clientTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage.trim(), clientTime }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage('');
        setIsAtBottom(true); // User just sent a message, so scroll to bottom
        // Scroll within chat container only, not the entire page
        if (chatContainerRef.current) {
          const container = chatContainerRef.current;
          requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
          });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to send message');
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

  // Initial load and periodic refresh
  useEffect(() => {
    setLoading(true);
    fetchMessages();

    // Refresh messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000);

    return () => clearInterval(interval);
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

  // Format time - show actual time like "03:10" or "23:43"
  const formatTime = (dateString: string) => {
    // SQLite returns datetime as 'YYYY-MM-DD HH:MM:SS' in localtime
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
    
    // Fallback: try to parse as Date
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg flex flex-col h-[500px] sm:h-[600px]">
      {/* Chat Header */}
      <div className="border-b border-gray-700 p-3 sm:p-4 flex items-center justify-between bg-gray-800/50">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-100">Global Chat</h3>
          <span className="text-xs text-gray-400">(clears every 24h)</span>
        </div>
        {error && (
          <div className="text-xs text-red-400 truncate max-w-[150px] sm:max-w-none">{error}</div>
        )}
      </div>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-400"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">No messages yet. Be the first to chat!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.user_id === currentUserId;
            // Use profile picture from message data, or fallback to current user's if it's their message
            const profilePicture = msg.profile_picture || (isOwnMessage ? currentUserProfilePicture : null);
            
            return (
              <div
                key={msg.id}
                className={`flex gap-2 sm:gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Profile Picture */}
                <div className="flex-shrink-0">
                  {profilePicture ? (
                    <img
                      src={getImageUrl(profilePicture) || ''}
                      alt={msg.username}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-gray-600 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) {
                          fallback.style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center ${profilePicture ? 'hidden' : ''}`}
                  >
                    <span className="text-gray-400 text-xs sm:text-sm font-semibold">
                      {msg.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Message Content */}
                <div className={`flex-1 min-w-0 ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
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

      {/* Input Form */}
      <form onSubmit={sendMessage} className="border-t border-gray-700 p-3 sm:p-4 bg-gray-800/50">
        <div className="flex gap-2 sm:gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            maxLength={500}
            disabled={sending}
            className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 sm:px-6 py-2 sm:py-2.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base font-medium touch-manipulation min-h-[44px] whitespace-nowrap"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          {newMessage.length}/500 characters
        </p>
      </form>
    </div>
  );
}

