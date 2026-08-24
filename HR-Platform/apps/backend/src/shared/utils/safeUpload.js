import crypto from 'crypto';

/**
 * Shared helpers for every multer storage config in upload.js.
 *
 * Two mistakes the old per-upload storage configs all repeated:
 *
 * 1. Filenames were built from `Date.now() + Math.round(Math.random() * 1e9)`
 *    — not cryptographically random. Half of that (the timestamp) is
 *    trivially guessable, which matters because these files are served
 *    from unauthenticated/predictable-adjacent paths (see app.js).
 *
 * 2. The stored extension came from `path.extname(file.originalname)` —
 *    i.e. whatever the *client* named the file. Combined with a MIME check
 *    that also only looks at the client-supplied `file.mimetype` header,
 *    this let an attacker upload real HTML/SVG content named "evil.html"
 *    while lying about Content-Type, and the server would happily save it
 *    as `<random>.html`. Static file servers (Express's `sendFile`,
 *    nginx) set the response `Content-Type` from the file's *extension on
 *    disk* — so that saved .html file would later be served back as
 *    `text/html` and execute in the browser: stored XSS.
 *
 * The fix used here doesn't attempt real content sniffing (magic bytes) —
 * that's a larger change. Instead, the extension actually written to disk
 * is looked up from a fixed allow-list keyed by the already-validated
 * mimetype, never taken from the client's filename. Whatever the file's
 * true bytes are, it can only ever be saved with — and therefore later
 * served back as — one of the extensions the caller explicitly trusts.
 */

export function randomFilename(ext) {
  return `${crypto.randomBytes(16).toString('hex')}${ext}`;
}

/**
 * Builds a multer `filename` function that ignores the client's own
 * filename/extension entirely and derives a safe one from `mimeExtMap`
 * (validated mimetype -> fixed extension). Assumes a `fileFilter` has
 * already rejected any mimetype not present in the map.
 */
export function safeFilenameFromMime(mimeExtMap) {
  return (req, file, cb) => {
    const ext = mimeExtMap[file.mimetype];
    if (!ext) {
      // Shouldn't happen if fileFilter is consistent with this map, but
      // never fall back to a client-controlled extension.
      return cb(new Error('Fayl turi qo\'llab-quvvatlanmaydi'));
    }
    cb(null, randomFilename(ext));
  };
}
