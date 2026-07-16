import { createElement, type CSSProperties, type ElementType, type HTMLAttributes } from 'react';
import {
  usernameDisplayClassName,
  usernameDisplayStyle,
  type UsernameWaveTint,
} from '../lib/usernameColor';

type UsernameDisplayProps = {
  username: string;
  usernameColor?: string | null;
  usernameWaveFrom?: string | null;
  usernameWaveTo?: string | null;
  className?: string;
  as?: ElementType;
  title?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'style' | 'color' | 'title'>;

function waveTint(
  from?: string | null,
  to?: string | null
): UsernameWaveTint | undefined {
  if (!from && !to) return undefined;
  return { from, to };
}

export function UsernameDisplay({
  username,
  usernameColor,
  usernameWaveFrom,
  usernameWaveTo,
  className = '',
  as,
  title,
  style: styleProp,
  ...rest
}: UsernameDisplayProps) {
  const Tag = as ?? 'span';
  const tint = waveTint(usernameWaveFrom, usernameWaveTo);
  const style = { ...usernameDisplayStyle(usernameColor, tint), ...styleProp };
  const displayClassName = usernameDisplayClassName(usernameColor, tint, className);

  return createElement(
    Tag,
    {
      className: displayClassName || undefined,
      style,
      title: title ?? username,
      ...rest,
    },
    username
  );
}
