type Listener = (event: unknown) => void;

const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitPreviewEvent(event: unknown): void {
  for (const listener of listeners) listener(event);
}
