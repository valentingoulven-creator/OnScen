import { type ReactNode } from 'react';
import { Virtuoso } from 'react-virtuoso';

type VirtualListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  /** Use document scroll (feed tabs) vs parent scroll (DM). */
  useWindowScroll?: boolean;
  customScrollParent?: HTMLElement | null;
  followOutput?: boolean | 'smooth' | 'auto';
  initialTopMostItemIndex?: number;
};

/** Generic virtual list — only mounts visible rows. */
export function VirtualList<T>({
  items,
  renderItem,
  className,
  useWindowScroll = false,
  customScrollParent,
  followOutput,
  initialTopMostItemIndex,
}: VirtualListProps<T>) {
  return (
    <Virtuoso
      className={className}
      useWindowScroll={useWindowScroll}
      customScrollParent={customScrollParent ?? undefined}
      data={items}
      overscan={300}
      followOutput={followOutput}
      initialTopMostItemIndex={initialTopMostItemIndex}
      itemContent={(index, item) => renderItem(item, index)}
    />
  );
}
