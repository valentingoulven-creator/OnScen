let activeHostLiveId: string | null = null;

export function setActiveHostLiveId(liveId: string | null): void {
  activeHostLiveId = liveId;
}

export function getActiveHostLiveId(): string | null {
  return activeHostLiveId;
}
