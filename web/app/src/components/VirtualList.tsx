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
  // Ne pas passer undefined à Virtuoso : initialTopMostItemIndex undefined provoque
  // « Cannot read properties of undefined (reading 'index') » au scroll initial (fil).
  return (
    <Virtuoso
      className={className}
      useWindowScroll={useWindowScroll}
      data={items}
      overscan={300}
      itemContent={(index, item) => renderItem(item, index)}
      {...(customScrollParent != null ? { customScrollParent } : {})}
      {...(followOutput !== undefined ? { followOutput } : {})}
      {...(typeof initialTopMostItemIndex === 'number' && Number.isFinite(initialTopMostItemIndex)
        ? { initialTopMostItemIndex }
        : {})}
    />
  );
}
