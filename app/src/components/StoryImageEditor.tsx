import type { StoryLink, StoryMusicTrack, StoryTaggedUser } from '../types';
import { PhotoImageEditor, type PhotoEditorResult } from './PhotoImageEditor';

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

export function StoryImageEditor(props: StoryImageEditorProps) {
  return <PhotoImageEditor mode="story" {...props} />;
}
