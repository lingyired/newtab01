// Toast — single-instance transient message at the bottom of the page.
//
// Created in v1.0.31 for the lockColumns "drag refuses to add a new
// column" feedback case in drop-handler.ts. The codebase has no prior
// notification primitive, so this is a minimal 30-line helper rather
// than a generic toast manager. If a second caller appears, promote
// it to a small queue and add a `variant` (success / warning / error).

let container: HTMLDivElement | null = null;
let hideTimer: number | null = null;

export function showToast(message: string, durationMs = 2500): void {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Re-render as a single line — clear previous text so two back-to-
  // back toasts don't stack visually.
  container.textContent = '';
  const line = document.createElement('p');
  line.className = 'toast-message';
  line.textContent = message;
  container.appendChild(line);

  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
  }
  hideTimer = window.setTimeout(() => {
    if (container) {
      container.textContent = '';
    }
    hideTimer = null;
  }, durationMs);
}
