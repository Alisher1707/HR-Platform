import path from 'path';
import fs from 'fs';

/**
 * Serves one file from a fixed upload directory by filename, replacing the
 * plain `express.static` mounts app.js used to have on every /uploads/*
 * path. Those were reachable by anyone who had (or guessed) a URL — no
 * login required — which meant employee photos, resumes, fine evidence
 * and Telegram-submitted appeal documents were all effectively public.
 * The route this builds is meant to sit behind `authenticate` (and
 * usually `authorize`) in app.js; this middleware itself only handles safe
 * path resolution and the response.
 *
 * `filename` is taken from the URL param, not a nested path, so there is
 * nothing to traverse with `../` — but the allow-list regex plus the
 * resolved-path check are kept as defense in depth in case that ever
 * changes.
 */
const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]{1,10}$/;

export function serveUploadedFile(dir) {
  const resolvedDir = path.resolve(dir);

  return (req, res) => {
    const { filename } = req.params;

    if (!filename || !SAFE_FILENAME.test(filename)) {
      return res.status(400).json({ success: false, message: "Noto'g'ri fayl nomi" });
    }

    const filePath = path.join(resolvedDir, filename);
    if (!filePath.startsWith(resolvedDir + path.sep)) {
      return res.status(400).json({ success: false, message: "Noto'g'ri fayl yo'li" });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Fayl topilmadi' });
    }

    // Content-Type is left to res.sendFile's own extension-based lookup —
    // safe here because every writer of these directories (upload.js,
    // telegramApi.js) now names files from a fixed, validated extension
    // allow-list, never from client-supplied input. See safeUpload.js.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  };
}
