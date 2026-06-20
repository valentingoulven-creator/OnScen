import { splitTextWithLinks, type InternalLinkTarget } from '../lib/linkifyText';

const LINK_CLASS = 'underline decoration-current/60 hover:decoration-current break-all';

type LinkifiedTextProps = {
  text: string;
  className?: string;
  onOpenFeedPost?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string) => void;
};

/**
 * Pure predicate: returns true if we can render this target as an in-app link.
 * Must NOT call any handler — safe to use during render.
 */
function canHandleInternally(
  target: InternalLinkTarget,
  handlers: Pick<LinkifiedTextProps, 'onOpenFeedPost' | 'onOpenProfile' | 'onOpenSalon'>
): boolean {
  if (target.kind === 'post') return true; // always handled (hash fallback exists)
  if (target.kind === 'profile') return Boolean(handlers.onOpenProfile);
  if (target.kind === 'salon') return Boolean(handlers.onOpenSalon);
  return false;
}

/**
 * Imperative: actually invokes the appropriate handler. Call only from event
 * handlers (onClick), never during render.
 */
function handleInternalLink(
  target: InternalLinkTarget,
  handlers: Pick<LinkifiedTextProps, 'onOpenFeedPost' | 'onOpenProfile' | 'onOpenSalon'>
): void {
  if (target.kind === 'post') {
    if (handlers.onOpenFeedPost) {
      handlers.onOpenFeedPost(target.postId);
    } else if (typeof window !== 'undefined') {
      window.location.hash = `#/post/${encodeURIComponent(target.postId)}`;
    }
    return;
  }
  if (target.kind === 'profile' && handlers.onOpenProfile) {
    handlers.onOpenProfile(target.userId);
    return;
  }
  if (target.kind === 'salon' && handlers.onOpenSalon) {
    handlers.onOpenSalon(target.salonId);
  }
}

export function LinkifiedText({
  text,
  className,
  onOpenFeedPost,
  onOpenProfile,
  onOpenSalon,
}: LinkifiedTextProps) {
  const segments = splitTextWithLinks(text);
  const hasLinks = segments.some((s) => s.type === 'link');

  if (!hasLinks) {
    return <p className={className}>{text}</p>;
  }

  const handlers = { onOpenFeedPost, onOpenProfile, onOpenSalon };

  return (
    <p className={className}>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          return <span key={i}>{seg.value}</span>;
        }

        const internal = seg.internal;
        if (internal && canHandleInternally(internal, handlers)) {
          return (
            <a
              key={i}
              href={seg.href}
              className={LINK_CLASS}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleInternalLink(internal, handlers);
              }}
            >
              {seg.display}
            </a>
          );
        }

        return (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
            onClick={(e) => e.stopPropagation()}
          >
            {seg.display}
          </a>
        );
      })}
    </p>
  );
}
