import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { authRouter } from './routes/auth';
import { geoRouter } from './routes/geo';
import { salonsRouter } from './routes/salons';
import { livesRouter } from './routes/lives';
import { chatRouter } from './routes/chat';
import { dmRouter } from './routes/dm';
import { giftsRouter } from './routes/gifts';
import { networkRouter } from './routes/network';
import { ratingsRouter } from './routes/ratings';
import { notificationsRouter } from './routes/notifications';
import { reelsRouter } from './routes/reels';
import { usersRouter } from './routes/users';
import { platformsRouter } from './routes/platforms';
import { getPublicDir, getMsdevConfigPath } from './paths';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const publicDir = getPublicDir();
app.use(express.static(publicDir));

app.use('/api/auth', authRouter);
app.use('/api/geo', geoRouter);
app.use('/api/salons', salonsRouter);
app.use('/api/lives', livesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/dm', dmRouter);
app.use('/api/gifts', giftsRouter);
app.use('/api/network', networkRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/users', usersRouter);
app.use('/api/platforms', platformsRouter);

app.get('/api/config', (_req, res) => {
  const configPath = getMsdevConfigPath();
  if (fs.existsSync(configPath)) {
    res.sendFile(configPath);
    return;
  }
  res.json({
    env: process.env.APP_ENV || 'development',
    apiBaseUrl: `/api`,
    socketUrl: '/',
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    app: 'MeloSong',
    env: process.env.APP_ENV || 'development',
    timestamp: new Date(),
  });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    next();
    return;
  }
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('MeloSong app not built. Run: npm run app:build');
  }
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large' || e?.status === 413) {
    res.status(413).json({
      error: 'Profil trop volumineux (photos). Retirez une photo ou utilisez des images plus légères.',
    });
    return;
  }
  next(err);
});
