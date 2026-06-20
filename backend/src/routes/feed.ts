import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { schedulePersist } from '../lib/persist';
import {
  createFeedPost,
  listFeedPosts,
  resharePost,
  toggleFeedPostLike,
  addFeedPostComment,
  listFeedPostComments,
  toggleFeedPostFavorite,
  listFavoritedFeedPosts,
} from '../lib/feedPosts';
import { notifyMentions } from '../lib/mentions';
import { notifyContentHeartReceived, notifyEventCreated } from '../lib/notifications';
import { db } from '../models/schema';

export const feedRouter = Router();

feedRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const q = req.query;
  const limit = q.limit != null ? Number(q.limit) : undefined;
  const before = q.before != null ? Number(q.before) : undefined;
  const eventsOnly = q.eventsOnly === 'true' || q.eventsOnly === '1' ? true : undefined;
  const userEventsOnly = q.userEventsOnly === 'true' || q.userEventsOnly === '1' ? true : undefined;
  const eventDate = typeof q.eventDate === 'string' && q.eventDate ? q.eventDate : undefined;
  const eventLocationSearch =
    typeof q.eventLocationSearch === 'string' && q.eventLocationSearch
      ? q.eventLocationSearch
      : undefined;
  const eventCountry =
    typeof q.eventCountry === 'string' && q.eventCountry ? q.eventCountry : undefined;
  const eventTypeRaw = typeof q.eventType === 'string' ? q.eventType : undefined;
  const eventType =
    eventTypeRaw === 'dance' || eventTypeRaw === 'chant' || eventTypeRaw === 'autre'
      ? eventTypeRaw
      : undefined;
  const useAlgo = q.algo === 'true' || q.algo === '1' ? true : undefined;
  const followingOnly = q.followingOnly === 'true' || q.followingOnly === '1' ? true : undefined;
  const authorId =
    typeof q.authorId === 'string' && q.authorId ? q.authorId : undefined;
  res.json({
    posts: listFeedPosts(me, {
      limit,
      before,
      eventsOnly,
      userEventsOnly,
      eventDate,
      eventLocationSearch,
      eventCountry,
      eventType,
      useAlgo,
      followingOnly,
      authorId,
    }),
  });
});

feedRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const body = req.body ?? {};
  const result = createFeedPost(me, {
    content: String(body.content ?? ''),
    imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
    videoUrl: body.videoUrl != null ? String(body.videoUrl) : undefined,
    isEvent: body.isEvent === true,
    eventDate: body.eventDate != null ? String(body.eventDate) : undefined,
    eventDates: Array.isArray(body.eventDates) ? body.eventDates : undefined,
    eventEndTimes: Array.isArray(body.eventEndTimes) ? body.eventEndTimes : undefined,
    eventLocation: body.eventLocation != null ? String(body.eventLocation) : undefined,
    eventType: body.eventType != null ? String(body.eventType) : undefined,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  schedulePersist();
  const postAuthor = db.users.get(me);
  if (postAuthor && result.post.content) {
    const ctx = result.post.isEvent ? 'event' : 'post';
    notifyMentions(result.post.content, me, postAuthor.username, ctx, result.post.id, postAuthor.avatarUrl);
  }
  if (result.post.isEvent && postAuthor) {
    notifyEventCreated({
      creator: { id: me, username: postAuthor.username, avatarUrl: postAuthor.avatarUrl },
      postId: result.post.id,
      eventLocation: result.post.eventLocation,
    });
  }
  res.status(201).json({ post: result.post });
});

// ── Favoris (bookmarked posts) ────────────────────────────────────────────────

feedRouter.get('/favorites', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  res.json({ posts: listFavoritedFeedPosts(me) });
});

// ── Per-post interactions ─────────────────────────────────────────────────────

feedRouter.post('/posts/:id/like', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = toggleFeedPostLike(me, req.params.id);
  if (!result.ok) { res.status(404).json({ error: result.error }); return; }
  if (!result.liked) { res.status(400).json({ error: 'Déjà aimé' }); return; }
  schedulePersist();
  const post = db.feedPosts.find((p) => p.id === req.params.id);
  const sender = db.users.get(me);
  if (post && sender) {
    notifyContentHeartReceived({
      recipientId: post.userId,
      sender: { id: me, username: sender.username, avatarUrl: sender.avatarUrl },
      target: { kind: 'post', id: post.id },
    });
  }
  res.json({ liked: result.liked, likeCount: result.likeCount });
});

feedRouter.delete('/posts/:id/like', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = toggleFeedPostLike(me, req.params.id);
  if (!result.ok) { res.status(404).json({ error: result.error }); return; }
  schedulePersist();
  res.json({ liked: result.liked, likeCount: result.likeCount });
});

feedRouter.get('/posts/:id/comments', authenticateJWT, (req: Request, res: Response) => {
  res.json({ comments: listFeedPostComments(req.params.id) });
});

feedRouter.post('/posts/:id/comments', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const body = req.body ?? {};
  const result = addFeedPostComment(me, req.params.id, String(body.content ?? ''));
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  schedulePersist();
  const commentAuthor = db.users.get(me);
  if (commentAuthor) {
    notifyMentions(result.comment.content, me, commentAuthor.username, 'comment', req.params.id, commentAuthor.avatarUrl);
  }
  res.status(201).json({ comment: result.comment, commentCount: result.commentCount });
});

feedRouter.post('/posts/:id/reshare', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = resharePost(me, req.params.id);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  schedulePersist();
  res.status(201).json({ post: result.post });
});

feedRouter.post('/posts/:id/favorite', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = toggleFeedPostFavorite(me, req.params.id);
  if (!result.ok) { res.status(404).json({ error: result.error }); return; }
  if (!result.favorited) { res.status(400).json({ error: 'Déjà en favoris' }); return; }
  schedulePersist();
  res.json({ favorited: result.favorited });
});

feedRouter.delete('/posts/:id/favorite', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const result = toggleFeedPostFavorite(me, req.params.id);
  if (!result.ok) { res.status(404).json({ error: result.error }); return; }
  schedulePersist();
  res.json({ favorited: result.favorited });
});
