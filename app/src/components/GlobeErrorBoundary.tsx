import { Component, type ErrorInfo, type ReactNode } from 'react';

import { disableGlobeView, isWebGLError } from '../lib/webglSupport';



interface Props {

  children: ReactNode;

  onUnavailable: () => void;

}



interface State {

  failed: boolean;

  unhandledError: unknown;

}



/**

 * Catches react-globe.gl / Three.js render failures (WebGL context limits, GPU off, etc.)

 * and falls back to the flat Leaflet map instead of crashing the whole app.

 */

export class GlobeErrorBoundary extends Component<Props, State> {

  state: State = { failed: false, unhandledError: null };



  static getDerivedStateFromError(error: unknown): State | null {

    if (isWebGLError(error)) return { failed: true, unhandledError: null };

    return { failed: false, unhandledError: error };

  }



  componentDidCatch(error: unknown, info: ErrorInfo): void {

    if (!isWebGLError(error)) return;

    console.warn('[GlobeView] unavailable:', error, info.componentStack);

    disableGlobeView();

    this.props.onUnavailable();

  }



  render() {

    if (this.state.unhandledError) throw this.state.unhandledError;

    if (this.state.failed) return null;

    return this.props.children;

  }

}

