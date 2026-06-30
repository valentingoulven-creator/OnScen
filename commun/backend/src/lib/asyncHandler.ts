import { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Enveloppe un handler Express async pour garantir que tout rejet de promesse
 * est transmis à `next(err)` (et donc à l'error handler global / Sentry) au
 * lieu de finir en `unhandledRejection` silencieux, laissant le client sans
 * réponse HTTP.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
