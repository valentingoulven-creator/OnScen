import { db } from '../models/schema';

export function getHostRatingSummary(hostId: string, viewerId?: string) {
  const ratings = db.hostRatings.filter((r) => r.hostId === hostId);
  const count = ratings.length;
  const average = count ? ratings.reduce((sum, r) => sum + r.stars, 0) / count : 0;
  const userRating = viewerId
    ? ratings.find((r) => r.raterId === viewerId)?.stars
    : undefined;

  return {
    average: count ? Math.round(average * 10) / 10 : 0,
    count,
    userRating,
  };
}
