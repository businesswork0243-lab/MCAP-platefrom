import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import { contentQueueEvents } from '../jobs/queue';

let io: SocketServer;

export function initWebSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.WEB_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    const requestId = socket.handshake.query.requestId as string;

    if (requestId) {
      socket.join(`request:${requestId}`);
    }

    socket.on('subscribe:request', (id: string) => {
      socket.join(`request:${id}`);
    });

    socket.on('subscribe:org', (orgId: string) => {
      socket.join(`org:${orgId}`);
    });

    socket.on('disconnect', () => {});
  });

  // Broadcast queue events to subscribed clients
  contentQueueEvents.on('progress', ({ jobId, data }) => {
    const progress = typeof data === 'number' ? data : (data as any)?.percentage ?? 0;
    const requestId = (data as any)?.requestId;
    if (requestId) {
      emit(`request:${requestId}`, 'job:progress', { jobId, progress });
    }
  });

  contentQueueEvents.on('completed', ({ jobId, returnvalue }) => {
    const parsed = safeParseJson(returnvalue);
    if (parsed?.requestId) {
      emit(`request:${parsed.requestId}`, 'job:completed', { jobId });
    }
  });

  contentQueueEvents.on('failed', ({ jobId, failedReason }) => {
    emit('failed', 'job:failed', { jobId, reason: failedReason });
  });

  return io;
}

export function emit(room: string, event: string, data: object) {
  if (io) {
    io.to(room).emit(event, data);
  }
}

export function emitToOrg(orgId: string, event: string, data: object) {
  emit(`org:${orgId}`, event, data);
}

function safeParseJson(val: unknown): Record<string, unknown> | null {
  if (!val) return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return null;
  }
}
