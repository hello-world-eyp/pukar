export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogContext {
  roomCode?: string;
  playerId?: string;
  socketId?: string;
  actionType?: string;
  error?: unknown;
  [key: string]: unknown;
}

function safeString(val: unknown): string {
  if (typeof val === 'symbol') {
    return val.toString();
  }
  if (val === null || val === undefined) {
    return String(val);
  }
  try {
    return String(val);
  } catch {
    try {
      return Object.prototype.toString.call(val);
    } catch {
      return '[unstringifiable]';
    }
  }
}

function safeStringify(val: unknown): string {
  try {
    return JSON.stringify(val, (_key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (typeof value === 'symbol') {
        return value.toString();
      }
      return value;
    });
  } catch {
    return '[unserializable]';
  }
}

export function formatLogMessage(
  level: LogLevel,
  message: unknown,
  context?: LogContext
): string {
  try {
    const timestamp = new Date().toISOString();
    const upperLevel = safeString(level).toUpperCase();
    const roomTag = context?.roomCode ? ` [ROOM:${safeString(context.roomCode)}]` : '';
    const playerTag = context?.playerId ? ` [PLAYER:${safeString(context.playerId)}]` : '';
    const actionTag = context?.actionType ? ` [ACTION:${safeString(context.actionType)}]` : '';

    let extra = '';
    if (context) {
      const { roomCode, playerId, actionType, error, ...rest } = context;
      if (error !== undefined && error !== null) {
        if (error instanceof Error) {
          extra += error.stack
            ? ` | Error: ${error.message}\n${error.stack}`
            : ` | Error: ${error.message}`;
        } else if (typeof error === 'object') {
          const serialized = safeStringify(error);
          extra += serialized !== '[unserializable]'
            ? ` | Error: ${serialized}`
            : ` | Error: ${safeString(error)}`;
        } else {
          extra += ` | Error: ${safeString(error)}`;
        }
      }
      const restKeys = Object.keys(rest);
      if (restKeys.length > 0) {
        const serializedRest = safeStringify(rest);
        extra += ` | Data: ${serializedRest}`;
      }
    }

    return `[${timestamp}] [${upperLevel}]${roomTag}${playerTag}${actionTag} ${safeString(message)}${extra}`;
  } catch {
    try {
      const upperLevel = safeString(level).toUpperCase();
      return `[LOG_FALLBACK] [${upperLevel}] ${safeString(message)}`;
    } catch {
      return `[LOG_FALLBACK] [UNKNOWN] log formatting error`;
    }
  }
}

export const formatLog = formatLogMessage;

export const serverLogger = {
  debug: (message: string, context?: LogContext): void => {
    try {
      console.debug(formatLogMessage('DEBUG', message, context));
    } catch {
      // Defensive fallback - logger must never throw
    }
  },
  info: (message: string, context?: LogContext): void => {
    try {
      console.log(formatLogMessage('INFO', message, context));
    } catch {
      // Defensive fallback - logger must never throw
    }
  },
  warn: (message: string, context?: LogContext): void => {
    try {
      console.warn(formatLogMessage('WARN', message, context));
    } catch {
      // Defensive fallback - logger must never throw
    }
  },
  error: (message: string, context?: LogContext): void => {
    try {
      console.error(formatLogMessage('ERROR', message, context));
    } catch {
      // Defensive fallback - logger must never throw
    }
  },
};

export const logger = serverLogger;

