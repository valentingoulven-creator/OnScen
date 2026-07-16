import { Component, type ErrorInfo, type ReactNode } from 'react';

import { disableGlobeView } from '../lib/webglSupport';

interface Props {
  children: ReactNode;
  onUnavailable: () => void;
}

interface State {
  failed: boolean;
}

/**
 * Catches Three.js / React Three Fiber render failures under the 3D globe
 * subtree (WebGL context limits, GPU off, texture/shader errors, drei bugs,
 * etc.) and falls back to the flat Leaflet map instead of crashing the whole
 * app. This boundary wraps *only* `<GlobeView>` (see MapView.tsx) — so any
 * error caught here is by construction a globe failure, not a false positive
 * from an unrelated component. We intentionally catch everything (not just
 * WebGL-specific error messages) since drei/R3F throw generic JS errors
 * (e.g. texture 404, undefined property) that `isWebGLError()` would miss,
 * previously letting those crash `MapView`/`AppErrorBoundary` instead of
 * degrading gracefully to the flat map.
 */
export class GlobeErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.warn('[GlobeView] unavailable:', error, info.componentStack);
    disableGlobeView();
    this.props.onUnavailable();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

