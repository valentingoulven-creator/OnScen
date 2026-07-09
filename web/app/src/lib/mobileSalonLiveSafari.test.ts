import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const appSrc = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Salon / Live — compat Safari mobile (CSS + structure)', () => {
  const indexCss = readFileSync(join(appSrc, 'index.css'), 'utf8');
  const appTsx = readFileSync(join(appSrc, 'App.tsx'), 'utf8');
  const salonPage = readFileSync(join(appSrc, 'pages', 'SalonPage.tsx'), 'utf8');
  const livePage = readFileSync(join(appSrc, 'pages', 'LivePage.tsx'), 'utf8');
  const ytPlayer = readFileSync(join(appSrc, 'components', 'SalonYouTubePlayer.tsx'), 'utf8');

  it('overlay plein écran salon/live avec safe-area', () => {
    expect(indexCss).toMatch(/\.ms-salon-fullscreen-overlay/);
    expect(indexCss).toMatch(/env\(safe-area-inset-bottom/);
    expect(indexCss).toMatch(/room-theater-layout--live-theater/);
  });

  it('chat live/salon au-dessus du dock flottant (design quick wins mobile)', () => {
    expect(indexCss).toMatch(
      /\[data-design-quick-wins="1"\][\s\S]*\.ms-salon-fullscreen-overlay[\s\S]*padding-bottom:\s*var\(--tab-nav-total-h\)/
    );
  });

  it('Salon mobile : chat en bas + stack vidéo', () => {
    expect(salonPage).toMatch(/useCompactMapViewport/);
    expect(salonPage).toMatch(/chatDock=\{mobileRoom \? 'bottom' : 'left'\}/);
    expect(salonPage).toMatch(/stackBelowVideo=\{mobileRoom\}/);
  });

  it('Live mobile : chat flottant (épinglé à gauche ou flottant) — refonte chat flottant', () => {
    // Depuis a20cf6c6 (chat flottant/PiP live), Live n'utilise plus un dock "bottom" fixe
    // (`chatDock="bottom"` + `stackBelowVideo`, cf. SalonPage) : le chat est soit épinglé à
    // gauche (`chatPinned`), soit flottant par-dessus la vidéo. RoomTheaterLayout gère son
    // propre toggle flottant générique via `allowFloatingChat`, désactivé ici car Live a sa
    // propre UX de chat flottant dédiée.
    expect(livePage).toMatch(/chatDock=\{chatPinned \? 'left' : 'floating'\}/);
    expect(livePage).toMatch(/allowFloatingChat=\{false\}/);
  });

  it('YouTube salon : playsinline pour iOS', () => {
    expect(ytPlayer).toMatch(/playsinline:\s*1/);
  });

  it('App : shells salon et live plein écran même chaîne flex', () => {
    expect(appTsx).toMatch(/ms-salon-fullscreen-overlay flex flex-col flex-1 min-h-0 h-full/);
    expect((appTsx.match(/ms-salon-fullscreen-overlay flex flex-col flex-1 min-h-0 h-full/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('cibles tactiles 44px sur contrôles salon mobile', () => {
    expect(indexCss).toMatch(/salon-theater-controls__toolbar[\s\S]*min-height:\s*2\.75rem/);
  });
});
