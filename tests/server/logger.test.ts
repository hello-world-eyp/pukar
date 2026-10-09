import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serverLogger, logger, formatLogMessage, formatLog } from '../../server/logger';

describe('Server Diagnostic Logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('formats log messages with timestamp, level, context tags, and message', () => {
    const formatted = formatLogMessage('INFO', 'Server started', {
      roomCode: 'ABCD',
      playerId: 'p1',
      actionType: 'CONNECT',
    });
    expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    expect(formatted).toContain('[INFO]');
    expect(formatted).toContain('[ROOM:ABCD]');
    expect(formatted).toContain('[PLAYER:p1]');
    expect(formatted).toContain('[ACTION:CONNECT]');
    expect(formatted).toContain('Server started');
  });

  it('preserves error stacks and details in ERROR logs', () => {
    const err = new Error('Test failure');
    const formatted = formatLogMessage('ERROR', 'Operation failed', {
      error: err,
      roomCode: 'ABCD',
    });
    expect(formatted).toContain('[ERROR]');
    expect(formatted).toContain('Operation failed');
    expect(formatted).toContain('Error: Test failure');
    expect(formatted).toContain(err.stack || '');
  });

  it('handles non-Error objects in error field', () => {
    const formatted = formatLogMessage('ERROR', 'String failure', {
      error: 'raw error string',
    });
    expect(formatted).toContain('[ERROR]');
    expect(formatted).toContain('String failure');
    expect(formatted).toContain('Error: raw error string');
  });

  it('serializes additional context data safely', () => {
    const formatted = formatLogMessage('DEBUG', 'Data dump', {
      cardCount: 13,
      seatIndex: 2,
    });
    expect(formatted).toContain('[DEBUG]');
    expect(formatted).toContain('Data dump');
    expect(formatted).toContain('"cardCount":13');
    expect(formatted).toContain('"seatIndex":2');
  });

  it('handles unserializable extra context gracefully in formatLogMessage', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const formatted = formatLogMessage('WARN', 'Circular warning', {
      roomCode: 'WILD',
      circular,
    });
    expect(formatted).toContain('[WARN]');
    expect(formatted).toContain('[ROOM:WILD]');
    expect(formatted).toContain('Circular warning');
    expect(formatted).toContain('[unserializable]');
  });

  it('safely handles logging without throwing even when circular or invalid context is passed to serverLogger', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => {
      serverLogger.debug('Circular debug', { circular });
      serverLogger.info('Circular info', { circular });
      serverLogger.warn('Circular warn', { roomCode: 'WILD', circular });
      serverLogger.error('Circular error', { circular });
    }).not.toThrow();
  });

  it('invokes respective console methods for each log level', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    serverLogger.debug('Debug msg', { roomCode: 'R1' });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy.mock.calls[0][0]).toContain('[DEBUG]');
    expect(debugSpy.mock.calls[0][0]).toContain('[ROOM:R1]');

    serverLogger.info('Info msg', { playerId: 'P1' });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0][0]).toContain('[INFO]');
    expect(infoSpy.mock.calls[0][0]).toContain('[PLAYER:P1]');

    serverLogger.warn('Warn msg');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('[WARN]');

    serverLogger.error('Error msg', { actionType: 'DISCARD' });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('[ERROR]');
    expect(errorSpy.mock.calls[0][0]).toContain('[ACTION:DISCARD]');
  });

  it('formats Error without stack trace without trailing newline', () => {
    const err = new Error('No stack error');
    err.stack = undefined;
    const formatted = formatLogMessage('ERROR', 'Stackless error', { error: err });
    expect(formatted).toContain('Error: No stack error');
    expect(formatted).not.toContain('No stack error\n');
  });

  it('falls back to LOG_FALLBACK if context access throws', () => {
    const badContext = {
      get roomCode(): string {
        throw new Error('Getter explode');
      },
    };
    const formatted = formatLogMessage('ERROR', 'Exploding context', badContext as any);
    expect(formatted).toBe('[LOG_FALLBACK] [ERROR] Exploding context');
  });

  it('formats correctly when context is undefined or empty', () => {
    const formatted = formatLogMessage('INFO', 'Plain message');
    expect(formatted).toContain('[INFO]');
    expect(formatted).toContain('Plain message');
    expect(formatted).not.toContain('ROOM');
    expect(formatted).not.toContain('PLAYER');
    expect(formatted).not.toContain('ACTION');
    expect(formatted).not.toContain('Error:');
    expect(formatted).not.toContain('Data:');
  });

  it('provides formatLog and logger aliases', () => {
    expect(formatLogMessage).toBeDefined();
    expect(formatLog).toBe(formatLogMessage);
    expect(serverLogger.info).toBeTypeOf('function');
    expect(logger).toBe(serverLogger);
  });

  it('preserves structured details when error is a plain object instead of [object Object]', () => {
    const formatted = formatLogMessage('ERROR', 'Socket failure', {
      error: { code: 'ECONNRESET', reason: 'socket hung up' },
    });
    expect(formatted).toContain('Socket failure');
    expect(formatted).toContain('"code":"ECONNRESET"');
    expect(formatted).toContain('"reason":"socket hung up"');
    expect(formatted).not.toContain('[object Object]');
  });

  it('handles numeric error codes including 0 without omission', () => {
    const formattedZero = formatLogMessage('ERROR', 'Process exited with code 0', { error: 0 });
    expect(formattedZero).toContain('Error: 0');

    const formattedCode = formatLogMessage('ERROR', 'HTTP failure', { error: 500 });
    expect(formattedCode).toContain('Error: 500');
  });

  it('safely serializes BigInt context data without throwing or reporting [unserializable]', () => {
    const formatted = formatLogMessage('DEBUG', 'BigInt metric', {
      timestampNs: 1234567890123456789n,
    });
    expect(formatted).toContain('BigInt metric');
    expect(formatted).toContain('1234567890123456789');
    expect(formatted).not.toContain('[unserializable]');
  });

  it('safely handles Symbol message and Symbol tag parameters without throwing TypeError', () => {
    const symbolMsg = Symbol('secret_event');
    const symbolRoom = Symbol('ROOM_SYM') as any;

    expect(() => {
      const formatted = formatLogMessage('INFO', symbolMsg, { roomCode: symbolRoom });
      expect(formatted).toContain('Symbol(secret_event)');
      expect(formatted).toContain('Symbol(ROOM_SYM)');
    }).not.toThrow();

    expect(() => {
      serverLogger.info(symbolMsg as any, { roomCode: symbolRoom });
    }).not.toThrow();
  });

  it('handles large payload context objects without crashing', () => {
    const largeArray = Array.from({ length: 5000 }, (_, i) => ({ id: i, name: `item_${i}` }));
    const formatted = formatLogMessage('DEBUG', 'Large payload processed', {
      items: largeArray,
    });
    expect(formatted).toContain('Large payload processed');
    expect(formatted).toContain('"id":4999');
  });

  it('normalizes lowercase log levels to uppercase', () => {
    const formatted = formatLogMessage('warn' as any, 'Lowercase level test');
    expect(formatted).toContain('[WARN]');
  });
});

