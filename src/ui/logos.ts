// Correction 11: recognizable streaming-service marks, implemented as small locally-defined SVG
// badges (brand-accurate color + a short wordmark), not reproductions of the real trademarked
// logo artwork and not fetched from any external asset host — safe, local, and dependency-free.
export interface ServiceBrand {
  bg: string; // CSS background (solid color or gradient)
  fg: string; // text color
  mark: string; // short wordmark/abbreviation shown inside the badge
}

const BRANDS: Record<string, ServiceBrand> = {
  netflix: { bg: '#E50914', fg: '#FFFFFF', mark: 'N' },
  'hbo-max': { bg: 'linear-gradient(135deg,#5B2A86,#1D1160)', fg: '#FFFFFF', mark: 'MAX' },
  'disney-plus': { bg: '#0B1F5C', fg: '#FFFFFF', mark: 'D+' },
  'prime-video': { bg: '#00A8E1', fg: '#0B1F2A', mark: 'prime' },
  skyshowtime: { bg: 'linear-gradient(135deg,#0032FF,#7A2EFF)', fg: '#FFFFFF', mark: 'sky' },
  'apple-tv': { bg: '#0B0B10', fg: '#FFFFFF', mark: 'tv' },
  viaplay: { bg: '#5B2AE8', fg: '#FFFFFF', mark: 'via' },
  'tv4-play': { bg: '#00A85D', fg: '#FFFFFF', mark: 'TV4' }
};

function brandFor(serviceKey: string, fallbackGlyph: string): ServiceBrand {
  // Custom service keys are user-controlled. Guard against inherited Object prototype names such
  // as "constructor"/"toString" being mistaken for a ServiceBrand entry.
  return Object.prototype.hasOwnProperty.call(BRANDS, serviceKey)
    ? BRANDS[serviceKey]!
    : { bg: '#2A2A36', fg: '#F4F5FA', mark: fallbackGlyph.slice(0, 3).toUpperCase() };
}

/** Compact square badge (used in dense contexts: Search rows, Library cards, History rows). */
export function serviceLogoHtml(serviceKey: string, fallbackGlyph: string, size = 26): string {
  const b = brandFor(serviceKey, fallbackGlyph);
  const fontSize = b.mark.length > 2 ? size * 0.32 : size * 0.44;
  return `<span class="svc-logo" style="width:${size}px;height:${size}px;background:${b.bg};color:${b.fg};font-size:${fontSize}px;" role="img" aria-label="${escapeHtml(fallbackGlyph)}">${escapeHtml(b.mark)}</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
