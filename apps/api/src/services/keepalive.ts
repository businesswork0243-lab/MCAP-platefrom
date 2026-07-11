import axios from 'axios';
import { logger } from '../lib/logger';

export function startKeepAlive() {
  const aiUrl = process.env.AI_ENGINE_URL;
  if (!aiUrl) return;

  // Every 10 minutes ping AI Engine
  setInterval(async () => {
    try {
      await axios.get(`${aiUrl}/health`, { timeout: 30_000 });
      logger.debug('AI Engine keep-alive ping successful');
    } catch (err) {
      logger.warn('AI Engine keep-alive ping failed');
    }
  }, 10 * 60 * 1000); // 10 minutes

  logger.info('✅ AI Engine keep-alive started');
}
