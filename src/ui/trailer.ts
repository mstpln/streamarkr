// Correction 8: a graceful, local "trailer" interaction — no live video API is available or
// permitted, so this renders a small dismissible overlay confirming the trailer opened rather
// than pretending to stream real video. When a title has no trailer, callers simply don't wire
// this up (or disable the control) — never a dead button that does nothing on click.
export function openTrailer(trailerKey: string | null | undefined, titleName: string): void {
  if (!trailerKey) return;
  const overlay = document.createElement('div');
  overlay.className = 'trailer-overlay';
  overlay.innerHTML = `
    <div class="trailer-modal" role="dialog" aria-modal="true" aria-label="Trailer for ${escapeHtml(titleName)}">
      <button class="action-btn" id="trailer-close" aria-label="Close trailer">✕ Close</button>
      <div class="trailer-body">
        <div class="trailer-play-icon" aria-hidden="true">▶</div>
        <div class="trailer-caption">Playing trailer for ${escapeHtml(titleName)}</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  overlay.querySelector('#trailer-close')!.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  (overlay.querySelector('#trailer-close') as HTMLElement).focus();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
