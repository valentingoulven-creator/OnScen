import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { usernameDisplayStyle, type UsernameWaveTint } from '../lib/usernameColor';

type UsernameDisplayProps<T extends ElementType = 'span'> = {
  username: string;
  usernameColor?: string | null;
  usernameWaveFrom?: string | null;
  usernameWaveTo?: string | null;
  className?: string;
  as?: T;
  title?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'children' | 'className' | 'style' | 'color'>;

function waveTint(
  from?: string | null,
  to?: string | null
): UsernameWaveTint | undefined {
  if (!from && !to) return undefined;
  return { from, to };
}

export function UsernameDisplay<T extends ElementType = 'span'>({
  username,
  usernameColor,
  usernameWaveFrom,
  usernameWaveTo,
  className = '',
  as,
  title,
  ...rest
}: UsernameDisplayProps<T>) {
  const Tag = (as ?? 'span') as ElementType;
  const tint = waveTint(usernameWaveFrom, usernameWaveTo);
  const style = usernameDisplayStyle(usernameColor, tint);

  return (
    <Tag className={className || undefined} style={style} title={title ?? username} {...rest}>
      {username}
    </Tag>
  );
}
