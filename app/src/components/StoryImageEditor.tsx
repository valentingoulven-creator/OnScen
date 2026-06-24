import { lazy, Suspense } from 'react';
import type { StoryLink, StoryMusicTrack, StoryTaggedUser } from '../types';
import type { PhotoEditorResult } from './PhotoImageEditor';

const PhotoImageEditor = lazy(() =>
  import('./PhotoImageEditor').then((m) => ({ default: m.PhotoImageEditor }))
);

export type StoryEditorResult = PhotoEditorResult;

interface StoryImageEditorProps {
  token: string;
  initialImage: string;
  initialSource?: File | string;
  initialMusicTrack?: StoryMusicTrack | null;
  initialTaggedUsers?: StoryTaggedUser[];
  initialLink?: StoryLink | null;
  onConfirm: (result: StoryEditorResult) => void;
  onCancel: () => void;
}

function EditorFallback() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80">
      <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
    </div>
  );
}

export function StoryImageEditor(props: StoryImageEditorProps) {
  return (
    <Suspense fallback={<EditorFallback />}>
      <PhotoImageEditor mode="story" {...props} />
    </Suspense>
  );
}
