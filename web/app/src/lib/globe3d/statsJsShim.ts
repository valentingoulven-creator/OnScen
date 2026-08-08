/**
 * Stub pour 'stats.js' (dépendance transitive de @react-three/drei via son
 * composant <Stats>, inutilisé par OnScen). Le vrai package est un bundle
 * UMD sans export ESM 'default' propre, ce qui fait planter soit la
 * résolution ESM native (module exclu du pre-bundle), soit l'optimiseur
 * esbuild de Vite (module inclus) selon la config. Comme drei réexporte
 * <Stats> de façon inconditionnelle dans son point d'entrée, cet import est
 * toujours exécuté même sans usage — d'où ce stub minimal aliasé dans
 * vite.config.ts (resolve.alias) pour couper la dépendance à la source.
 */
export default class StatsStub {
  dom: HTMLDivElement;
  constructor() {
    this.dom = document.createElement('div');
  }
  showPanel(): void {}
  begin(): void {}
  end(): void {}
  update(): void {}
}
