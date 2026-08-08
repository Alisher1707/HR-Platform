/**
 * Accepts a bare 11-char YouTube video ID or a full youtube.com/youtu.be URL
 * (watch, embed, shorts, with or without extra query params) and returns the
 * bare ID. Returns null for anything else — used both to embed the player and
 * to reject non-YouTube links in the "YouTube havolasi" field.
 */
export function extractYouTubeId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(
    /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(&\S*|\?\S*)?$/
  );
  return match ? match[4] : null;
}

export function isValidYouTubeInput(input) {
  return extractYouTubeId(input) !== null;
}
