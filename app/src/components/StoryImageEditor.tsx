import type { StoryMusicTrack, StoryTaggedUser } from '../types';
import { PhotoImageEditor, type PhotoEditorResult } from './PhotoImageEditor';

export type StoryEditorResult = PhotoEditorResult;

interface StoryImageEditorProps {
  token: string;
  initialImage: string;
  initialSource?: File | string;
  initialMusicTrack?: StoryMusicTrack | null;
  initialTaggedUsers?: StoryTaggedUser[];
  onConfirm: (result: StoryEditorResult) => void;
  onCancel: () => void;
}

export function StoryImageEditor(props: StoryImageEditorProps) {
  return <PhotoImageEditor mode="story" {...props} />;
}
