'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenManager } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressEvent {
  jobId:    string;
  progress: number;
  step:     string;
}

interface CompletedEvent {
  jobId:     string;
  requestId: string;
  message:   string;
}

interface FailedEvent {
  jobId:     string;
  requestId: string;
  reason:    string;
  message:   string;
}

interface UseContentSocketOptions {
  requestId:   string;
  onProgress?: (data: ProgressEvent) => void;
  onCompleted?: (data: CompletedEvent) => void;
  onFailed?:   (data: FailedEvent) => void;
  enabled?:    boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContentSocket({
  requestId,
  onProgress,
  onCompleted,
  onFailed,
  enabled = true,
}: UseContentSocketOptions) {
  const socketRef      = useRef<Socket | null>(null);
  const onProgressRef  = useRef(onProgress);
  const onCompletedRef = useRef(onCompleted);
  const onFailedRef    = useRef(onFailed);

  // Keep callbacks fresh without re-connecting
  useEffect(() => { onProgressRef.current  = onProgress;  }, [onProgress]);
  useEffect(() => { onCompletedRef.current = onCompleted; }, [onCompleted]);
  useEffect(() => { onFailedRef.current    = onFailed;    }, [onFailed]);

  const connect = useCallback(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
      ?.replace('/api', '')
      ?? 'http://localhost:4000';

    const token = tokenManager.get();

    const socket = io(apiUrl, {
      transports:  ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay:    1_000,
      reconnectionDelayMax: 10_000,
      timeout: 10_000,

      auth: {
        token: token ?? undefined,
      },

      query: {
        requestId,
      },
    });

    socket.on('connect', () => {
      // Subscribe to this specific request
      socket.emit('subscribe:request', requestId);
    });

    socket.on('connect_error', (err) => {
      if (err.message === 'TOKEN_EXPIRED') {
        // Disconnect — auth store will handle refresh
        socket.disconnect();
      }
    });

    socket.on('job:progress', (data: ProgressEvent) => {
      onProgressRef.current?.(data);
    });

    socket.on('job:completed', (data: CompletedEvent) => {
      onCompletedRef.current?.(data);
      socket.disconnect(); // Done — no need to stay connected
    });

    socket.on('job:failed', (data: FailedEvent) => {
      onFailedRef.current?.(data);
      socket.disconnect();
    });

    return socket;
  }, [requestId]);

  useEffect(() => {
    if (!enabled || !requestId) return;

    socketRef.current = connect();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [enabled, requestId, connect]);

  return {
    disconnect: () => socketRef.current?.disconnect(),
    isConnected: () => socketRef.current?.connected ?? false,
  };
}
