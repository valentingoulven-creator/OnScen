import type { Server } from 'socket.io';

/**
 * Optional Redis adapter for horizontal scaling (Socket.io cluster).
 * Requires REDIS_URL and packages @socket.io/redis-adapter + redis (install when scaling).
 */
export async function attachSocketClusterAdapter(io: Server): Promise<void> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return;

  try {
    const adapterModule = '@socket.io/redis-adapter';
    const redisModule = 'redis';
    const { createAdapter } = await import(/* webpackIgnore: true */ adapterModule);
    const { createClient } = await import(/* webpackIgnore: true */ redisModule);
    const pub = createClient({ url: redisUrl });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    io.adapter(createAdapter(pub, sub));
    console.log('[socket] Redis adapter actif — cluster multi-instances');
  } catch (err) {
    console.warn(
      '[socket] REDIS_URL défini mais adapter indisponible (installez @socket.io/redis-adapter et redis):',
      err
    );
  }
}
