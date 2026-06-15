import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { schedulePersist } from '../lib/persist';
import { createStory, getMyActiveStory, getUserActiveStories, listStoriesForViewer } from '../lib/stories';
import { notifyMentions } from '../lib/mentions';
import { db } from '../models/schema';

export const storiesRouter = Router();

storiesRouter.get('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const q = req.query;
  const latitude = q.latitude != null ? Number(q.latitude) : undefined;
  const longitude = q.longitude != null ? Number(q.longitude) : undefined;
  const radiusKm = q.radius != null ? Number(q.radius) : undefined;
  res.json({
    stories: listStoriesForViewer(me, {
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    }),
  });
});

storiesRouter.get('/mine', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const stories = getUserActiveStories(me);
  res.json({ stories, story: stories.length ? stories[stories.length - 1]! : null });
});

storiesRouter.post('/', authenticateJWT, (req: Request, res: Response) => {
  const me = (req as Request & { user: { id: string } }).user.id;
  const body = req.body ?? {};
  const result = createStory(me, {
    content: body.content != null ? String(body.content) : undefined,
    imageUrl: body.imageUrl != null ? String(body.imageUrl) : undefined,
    musicTrack: body.musicTrack,
    taggedUserIds: body.taggedUserIds,
    link: body.link,
    visibility: body.visibility,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  schedulePersist();
  const storyAuthor = db.users.get(me);
  if (storyAuthor && result.story.content) {
    notifyMentions(result.story.content, me, storyAuthor.username, 'story', result.story.id, storyAuthor.avatarUrl);
  }
  res.status(201).json({ story: result.story });
});
