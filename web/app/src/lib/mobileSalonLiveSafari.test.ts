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

    /* Sous le header fixe — pas inset:0 (passerait derrière le bandeau app). */
    expect(indexCss).toMatch(
      /\.ms-salon-fullscreen-overlay\s*\{[^}]*top:\s*var\(--app-header-total-h\)/s,
    );

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



  it('Live mobile : chat épinglé (colonne gauche) ou flottant', () => {

    expect(livePage).toMatch(/chatDock=\{chatPinned \? 'left' : 'floating'\}/);

    expect(livePage).toMatch(/allowFloatingChat=\{false\}/);

    expect(livePage).toMatch(/chatPinned/);

    expect(livePage).toMatch(/onToggleChatPin=\{toggleChatPin\}/);

    expect(livePage).toMatch(/videoExpanded=\{videoExpanded\}/);

  });



  it('Live chat épinglé : colonne gauche étroite + vidéo visible', () => {

    const roomTheater = readFileSync(join(appSrc, 'components', 'RoomTheaterLayout.tsx'), 'utf8');

    expect(indexCss).toMatch(/room-theater-chat-dock--live-left/);

    expect(indexCss).toMatch(/room-theater-side-row--live-left/);

    expect(indexCss).toMatch(/width:\s*min\(38vw,\s*200px\)/);

    expect(indexCss).toMatch(/width:\s*min\(260px,\s*28vw\)/);

    expect(roomTheater).toMatch(/room-theater-side-row--live-left/);

    expect(roomTheater).toMatch(/useLiveChatDockWidth/);

    expect(roomTheater).toMatch(/onscen-live-chat-dock-width/);

  });



  it('Live théâtre : bouton épingler/dépingler dans FloatingSalonChat', () => {

    const roomTheater = readFileSync(join(appSrc, 'components', 'RoomTheaterLayout.tsx'), 'utf8');

    expect(roomTheater).toMatch(/onTogglePin=\{liveTheaterChrome \? onToggleChatPin : undefined\}/);

    expect(roomTheater).toMatch(/pinned=\{liveTheaterChrome \? chatPinned : undefined\}/);

    expect(roomTheater).toMatch(/pinnedChatFullscreenWindow/);

  });



  it('Live : colonne chat épinglée + plein écran', () => {

    expect(indexCss).toMatch(/room-theater-chat-dock--live-left/);

    expect(indexCss).toMatch(/live-video-container--pinned-chat-fullscreen/);

    expect(indexCss).toMatch(/live-pinned-chat-fullscreen-dock/);

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

