import { Request, Response, NextFunction } from 'express';

export function isMsdevRuntime(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

export function assertMsdev(_req: Request, res: Response, next: NextFunction): void {
  if (!isMsdevRuntime()) {
    res.status(404).json({ error: 'Disponible en mode msdev uniquement' });
    return;
  }
  next();
}
