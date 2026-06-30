import { Request, Response, NextFunction } from 'express';

export function isMsdevRuntime(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

/** Hard-guard: returns true if the process is definitely running in production,
 *  regardless of APP_ENV / MSENV values. Used to double-lock msdev routes. */
function isDefinitelyProduction(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production'
  );
}

export function assertMsdev(_req: Request, res: Response, next: NextFunction): void {
  // Double check: block msdev routes unconditionally in production, even if
  // APP_ENV or MSENV is accidentally set to 'msdev' on the production server.
  if (isDefinitelyProduction() || !isMsdevRuntime()) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  next();
}
