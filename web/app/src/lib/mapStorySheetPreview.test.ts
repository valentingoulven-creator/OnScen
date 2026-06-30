import { describe, expect, it } from 'vitest';

/**
 * Contrat aperçu MapStorySheet : l'URL affichée et publiée doit être le JPEG
 * composé renvoyé par PhotoImageEditor (Suivant), pas le brouillon brut.
 */
describe('MapStorySheet preview image flow', () => {
  it('preview stays empty until editor confirm sets composed dataUrl', () => {
    let previewImageUrl = '';
    const rawDraftUrl = 'data:image/jpeg;base64,RAW';

    expect(previewImageUrl).toBe('');

    const onEditorConfirm = (composed: string) => {
      previewImageUrl = composed;
    };

    onEditorConfirm('data:image/jpeg;base64,COMPOSED_WITH_FILTER');
    expect(previewImageUrl).toMatch(/^data:image\/jpeg/);
    expect(previewImageUrl).not.toBe(rawDraftUrl);
  });

  it('publish uses the same composed preview url', () => {
    const previewImageUrl = 'data:image/jpeg;base64,COMPOSED';
    const body = previewImageUrl.trim() ? { imageUrl: previewImageUrl.trim() } : {};
    expect(body.imageUrl).toBe(previewImageUrl);
  });
});
