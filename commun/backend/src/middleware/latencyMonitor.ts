/**
 * Express middleware: records API response latency into the serverMonitor rolling window.
 * Applied to /api/* routes only; transparent to the response (no side effects on status/body).
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { recordApiLatency } from '../lib/serverMonitor';

export function latencyMonitorMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api/')) {
    next();
    return;
  }
  const start = performance.now();
  res.on('finish', () => {
    recordApiLatency(Math.round(performance.now() - start));
  });
  next();
}
