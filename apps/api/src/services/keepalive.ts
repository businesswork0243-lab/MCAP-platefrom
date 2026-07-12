// apps/api/src/services/keepalive.ts
import axios from 'axios';
import { logger } from '../lib/logger';

const AI_URL = (process.env.AI_ENGINE_URL || '').replace(/\/$/, '');

// Track last successful ping
let _lastPingSuccess = 0;

export function markAiEngineAlive(): void {
  _lastPingSuccess = Date.now();
}

export function getAiEngineLastSeen(): number {
  return _lastPingSuccess;
}

async function pingAiEngine(): Promise<boolean> {
  if (!AI_URL) return false;
  try {
    const res = await axios.get(`${AI_URL}/health`, { timeout: 20_000 });
    if (res.status === 200) {
      _lastPingSuccess = Date.now();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function startKeepAlive(): void {
  if (!AI_URL) {
    logger.warn('⚠️ AI_ENGINE_URL not set, keep-alive disabled');
    return;
  }

  // Startup pe ek ping karo
  pingAiEngine().then(ok => {
    if (ok) {
      logger.info('✅ AI Engine keep-alive started - engine is awake');
    } else {
      logger.warn('⚠️ AI Engine keep-alive started - engine is sleeping (will wake on demand)');
    }
  });

  // Har 8 minute mein ping karo
  // Render 15min mein sulate hai, 8min safe margin hai
  const INTERVAL_MS = 8 * 60 * 1000;

  setInterval(async () => {
    const ok = await pingAiEngine();
    if (ok) {
      logger.debug('💓 Keep-alive: AI Engine OK');
    } else {
      logger.warn('💀 Keep-alive: AI Engine not responding');
    }
  }, INTERVAL_MS);

  logger.info('✅ AI Engine keep-alive started', {
    interval: '8 minutes',
    aiEngineUrl: AI_URL,
  });
}
