// Search overlay — dim backdrop that appears when the search is active.
// The overlay element is created externally and passed in; this module just
// toggles its visibility and click-to-close behavior.

let overlay: HTMLElement | null = null;
let onClose: (() => void) | null = null;
let attachedClickHandler: ((e: MouseEvent) => void) | null = null;

/** Attach to an externally created overlay element. Idempotent. */
export function attachOverlay(el: HTMLElement): void {
  if (overlay === el) return;
  if (overlay && attachedClickHandler) {
    overlay.removeEventListener('click', attachedClickHandler);
    attachedClickHandler = null;
  }
  overlay = el;
  hideOverlay();
}

/** Show the overlay. Clicking it invokes onClose (typically to clear + blur). */
export function showOverlay(closeCb: () => void): void {
  if (!overlay) return;
  onClose = closeCb;
  if (attachedClickHandler) {
    overlay.removeEventListener('click', attachedClickHandler);
  }
  attachedClickHandler = () => {
    onClose?.();
  };
  overlay.addEventListener('click', attachedClickHandler);
  overlay.style.display = 'block';
}

/** Hide the overlay. */
export function hideOverlay(): void {
  if (!overlay) return;
  overlay.style.display = 'none';
}

export function isOverlayVisible(): boolean {
  return overlay?.style.display === 'block';
}
