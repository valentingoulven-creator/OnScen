import { describe, expect, it } from 'vitest';
import {
  DEFAULT_USERNAME_WAVE_FROM,
  DEFAULT_USERNAME_WAVE_TO,
  USERNAME_COLOR_WAVE,
  getUsernameStyle,
  isDefaultUsernameWaveTint,
  resolveUsernameWaveColors,
  usernameDisplayClassName,
  usernameDisplayStyle,
  usernameWaveDisplayStyle,
} from './usernameColor';

describe('usernameColor wave', () => {
  it('uses Soundy defaults when wave colors are missing', () => {
    expect(resolveUsernameWaveColors(null)).toEqual({
      from: DEFAULT_USERNAME_WAVE_FROM,
      to: DEFAULT_USERNAME_WAVE_TO,
    });
    expect(isDefaultUsernameWaveTint(null)).toBe(true);
  });

  it('applies custom gradient for wave pseudo', () => {
    const style = usernameDisplayStyle(USERNAME_COLOR_WAVE, {
      from: '#00ff00',
      to: '#0000ff',
    });
    expect(style?.backgroundImage).toBe('linear-gradient(to right, #00ff00, #0000ff)');
  });

  it('keeps default map marker class for default wave tint', () => {
    const { className, style } = getUsernameStyle(USERNAME_COLOR_WAVE);
    expect(className).toContain('map-marker-username--wave');
    expect(style).toBe('');
  });

  it('uses inline gradient on map for custom wave tint', () => {
    const { className, style } = getUsernameStyle(USERNAME_COLOR_WAVE, {
      from: '#ff0000',
      to: '#00ff00',
    });
    expect(className).not.toContain('map-marker-username--wave');
    expect(style).toContain('linear-gradient');
  });

  it('preview style matches wave display style', () => {
    const tint = { from: '#aabbcc', to: '#112233' };
    expect(usernameWaveDisplayStyle(tint)).toEqual(usernameDisplayStyle(USERNAME_COLOR_WAVE, tint));
  });

  it('adds bg-clip classes for custom wave tint', () => {
    const className = usernameDisplayClassName(USERNAME_COLOR_WAVE, {
      from: '#ff0000',
      to: '#00ff00',
    });
    expect(className).toContain('bg-clip-text');
    expect(className).toContain('text-transparent');
  });
});
