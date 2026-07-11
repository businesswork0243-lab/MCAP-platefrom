'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseContentSocketOptions {
  requestId:    string;
  enabled?:     boolean;
  onProgress?:  (data: { progress: number; step: string; [key: string]: unknown }) => void;
  onCompleted?: (data: { requestId: string; artifactCount?: number; totalTokens?: number }) => void;
  onFailed?:    (data: { requestId: string; reason?: string; error?: string }) => void;
}

export function useContentSocket({
  requestId,
  enabled = true,
  onProgress,
  onCompleted,
  onFailed,
}: UseContentSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled || !requestId) return;

    // Get token from localStorage
    const token = typeof window !== 'undefined' 
      ? localStorage.getItem('accessToken') 
      : null;

    if (!token) {
      console.warn('[Socket] No auth token, skipping connection');
      return;
    }

    // Determine WS URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://mcap-api.onrender.com/api';
    const wsUrl = apiUrl.replace(/\/api\/?$/, '');

    console.log('[Socket] Connecting to', wsUrl);

    // Create socket
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ── Connection Events ─────────────────────────────────────────
    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      
      // Get org ID from localStorage or context
      const authData = localStorage.getItem('mcap-auth');
      let orgId = '';
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          orgId = parsed?.state?.user?.organizationId || '';
        } catch {}
      }

      if (orgId) {
        socket.emit('join:org', orgId);
        console.log('[Socket] Joined org room:', orgId);
      }

      // Also join request-specific room
      socket.emit('join:request', requestId);
      console.log('[Socket] Joined request room:', requestId);
    });

    socket.on('joined', (data) => {
      console.log('[Socket] Join confirmed:', data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    // ── Content Events ────────────────────────────────────────────
    
    // Progress updates
    socket.on('content:progress', (data) => {
      if (data.requestId !== requestId) return;
      
      console.log('[Socket] Progress:', data.progress + '%', data.step);
      onProgress?.(data);
    });

    // Also listen to legacy status event
    socket.on('content:status', (data) => {
      if (data.requestId !== requestId) return;
      
      console.log('[Socket] Status:', data);
      if (typeof data.progress === 'number') {
        onProgress?.(data);
      }
    });

    // Completion
    socket.on('content:completed', (data) => {
      if (data.requestId !== requestId) return;
      
      console.log('[Socket] ✅ Completed:', data);
      onCompleted?.(data);
    });

    // Failure
    socket.on('content:failed', (data) => {
      if (data.requestId !== requestId) return;
      
      console.error('[Socket] ❌ Failed:', data);
      onFailed?.(data);
    });

    // ── Cleanup ───────────────────────────────────────────────────
    return () => {
      console.log('[Socket] Cleaning up');
      socket.off('content:progress');
      socket.off('content:status');
      socket.off('content:completed');
      socket.off('content:failed');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [requestId, enabled, onProgress, onCompleted, onFailed]);

  return { socket: socketRef.current };
}
