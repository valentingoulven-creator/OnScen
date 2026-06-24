/** Transfert de flux caméra/micro entre le modal pré-live et LivePage (iOS Safari). */

let handoffStream: MediaStream | null = null;

export function stashLiveCameraStream(stream: MediaStream): void {
  releaseLiveCameraHandoff();
  handoffStream = stream;
}

export function takeLiveCameraHandoff(): MediaStream | null {
  const stream = handoffStream;
  handoffStream = null;
  return stream;
}

export function releaseLiveCameraHandoff(): void {
  handoffStream?.getTracks().forEach((track) => track.stop());
  handoffStream = null;
}

export function hasLiveCameraHandoff(): boolean {
  return handoffStream !== null;
}
