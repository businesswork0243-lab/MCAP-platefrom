type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV !== 'production';

function formatLog(level: LogLevel, message: string | object, meta?: any): void {
  const entry: LogEntry = {
    level,
    message: typeof message === 'string' ? message : JSON.stringify(message),
    timestamp: new Date().toISOString(),
    ...(meta || {}),
    ...(typeof message === 'object' ? message : {}),
  };

  if (isDev) {
    // Dev mein readable format
    const colors = {
      debug: '\x1b[36m', // Cyan
      info:  '\x1b[32m', // Green
      warn:  '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';
    console.log(
      `${colors[level]}[${level.toUpperCase()}]${reset} ${entry.timestamp} - ${entry.message}`,
      meta && typeof meta === 'object' && Object.keys(meta).length ? meta : (meta !== undefined ? meta : '')
    );
  } else {
    // Production mein JSON format (Render logs ke liye)
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (message: string | object, meta?: any) => formatLog('debug', message, meta),
  info:  (message: string | object, meta?: any) => formatLog('info', message, meta),
  warn:  (message: string | object, meta?: any) => formatLog('warn', message, meta),
  error: (message: string | object, meta?: any) => formatLog('error', message, meta),
};
