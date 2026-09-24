import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import AdmZip from "adm-zip";
import { aircraftList } from "./src/data/aircraft";
import axios from "axios";

/**
 * Development/self-hosting server: Vite in development, the built site in
 * production, plus a small image-upload API for aircraft pictures.
 *
 * The upload API writes to disk, so every input that becomes part of a path or
 * a request is checked here. Before, a client-supplied folder name went straight
 * into path.join (path traversal: files anywhere could be deleted and
 * overwritten), any URL was fetched by the server (SSRF), SVGs were accepted
 * and served from the site's own origin (stored XSS), and a ZIP was extracted
 * without any size limit.
 */

/** Raster formats only: an SVG can carry script and would run on this origin. */
const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 2000;
const MAX_ZIP_ENTRY_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 500 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 60_000;

/** Hosts the "fetch ZIP from URL" feature may contact (Google Drive and its CDN). */
const ALLOWED_DOWNLOAD_HOSTS = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];
const isAllowedDownloadHost = (host: string) =>
  ALLOWED_DOWNLOAD_HOSTS.includes(host) || host.endsWith(".googleusercontent.com");

/** The folder name used for an aircraft's pictures, as the client computes it. */
const toSafeName = (manufacturer: string, type: string) =>
  `${manufacturer} ${type}`.split("/").join("-").split("\\").join("-");

/** Every folder name an upload may target. Anything else is rejected. */
const KNOWN_SAFE_NAMES = new Set(aircraftList.map(p => toSafeName(p.manufacturer, p.type)));

/** Resolves `name` inside `baseDir`, refusing anything that would escape it. */
function resolveInside(baseDir: string, name: string): string {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, name);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error(`Refusing path outside ${base}`);
  }
  return target;
}

/** A file name safe to write next to image.<ext>, or null. */
function safeFileName(name: string): string | null {
  const base = path.basename(name);
  if (!/^[A-Za-z0-9 ._()-]{1,120}$/.test(base)) return null;
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(path.extname(base).toLowerCase())) return null;
  return base;
}

class BadRequest extends Error {}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // No JSON endpoint needs more than a URL string; files go through multer.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  const planePicsDir = path.join(process.cwd(), "public", "PlanePics");
  const srcPlanePicsDir = path.join(process.cwd(), "src", "PlanePics");

  // ALWAYS serve /PlanePics directly from the actual public/PlanePics directory on disk
  // to prevent any static build/compilation caching or losing uploaded files.
  // Pictures are served as inert data: no sniffing, and nothing in them may run.
  app.use("/PlanePics", express.static(planePicsDir, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    }
  }));

  // Multer config using disk-storage to prevent high memory/OOM crashes on large ZIP files
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const upload = multer({
    dest: uploadDir,
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 }
  });

  // Get active images map for all aircrafts
  app.get("/api/aircraft-images", (req, res) => {
    try {
      const map: Record<string, string> = {};

      if (fs.existsSync(planePicsDir)) {
        const folders = fs.readdirSync(planePicsDir);
        for (const folder of folders) {
          const folderPath = path.join(planePicsDir, folder);
          if (fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath);
            // Look for best match image
            const bestFile = ALLOWED_IMAGE_EXTENSIONS.map(ext => `image${ext}`).find(f => files.includes(f)) ||
                             files.find(f => ALLOWED_IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()));

            if (bestFile) {
              map[folder] = `/PlanePics/${encodeURIComponent(folder)}/${encodeURIComponent(bestFile)}`;
            }
          }
        }
      }
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /** Replaces the pictures of one aircraft with `data`, in both picture folders. */
  function writeAircraftImage(safeName: string, ext: string, data: Buffer, originalName: string | null, alreadyCleared?: Set<string>) {
    const publicDestDir = resolveInside(planePicsDir, safeName);
    const srcDestDir = resolveInside(srcPlanePicsDir, safeName);

    if (!alreadyCleared || !alreadyCleared.has(safeName)) {
      alreadyCleared?.add(safeName);
      for (const dir of [publicDestDir, srcDestDir]) {
        if (!fs.existsSync(dir)) continue;
        try {
          for (const existingFile of fs.readdirSync(dir)) {
            const fPath = path.join(dir, existingFile);
            if (fs.statSync(fPath).isFile()) fs.unlinkSync(fPath);
          }
        } catch (e) {
          console.error(`[images] Failed to clear folder ${dir}:`, e);
        }
      }
    }

    fs.mkdirSync(publicDestDir, { recursive: true });
    fs.mkdirSync(srcDestDir, { recursive: true });

    const filename = `image${ext}`;
    fs.writeFileSync(path.join(publicDestDir, filename), data);
    fs.writeFileSync(path.join(srcDestDir, filename), data);

    // Also keep the original name when it is harmless, in case something references it.
    if (originalName && originalName !== filename) {
      fs.writeFileSync(path.join(publicDestDir, originalName), data);
      fs.writeFileSync(path.join(srcDestDir, originalName), data);
    }
    return filename;
  }

  async function processZipFile(filePath: string) {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    if (zipEntries.length > MAX_ZIP_ENTRIES) {
      throw new BadRequest(`The ZIP has ${zipEntries.length} entries; at most ${MAX_ZIP_ENTRIES} are accepted.`);
    }
    // Declared sizes are checked before anything is inflated, so a ZIP bomb is
    // refused instead of filling memory.
    const totalDeclared = zipEntries.reduce((sum, e) => sum + (e.isDirectory ? 0 : e.header.size), 0);
    if (totalDeclared > MAX_ZIP_TOTAL_BYTES) {
      throw new BadRequest(`The ZIP would expand to ${Math.round(totalDeclared / 1024 / 1024)} MB; the limit is ${MAX_ZIP_TOTAL_BYTES / 1024 / 1024} MB.`);
    }

    let extractCount = 0;
    const matchedPlanes: string[] = [];
    const clearedPlanes = new Set<string>();

    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const entryPath = entry.entryName;
      const ext = path.extname(entryPath).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) continue;
      if (entry.header.size > MAX_ZIP_ENTRY_BYTES) {
        console.warn(`[zip] Skipping ${entryPath}: larger than ${MAX_ZIP_ENTRY_BYTES / 1024 / 1024} MB`);
        continue;
      }

      let bestMatch: { safeName: string; matchLength: number } | null = null;
      const normPath = normalize(entryPath);

      for (const plane of aircraftList) {
        const fullName = plane.manufacturer + " " + plane.type;
        const safeName = toSafeName(plane.manufacturer, plane.type);

        const normSafe = normalize(safeName);
        const normFull = normalize(fullName);
        const normTypeOnly = normalize(plane.type);
        const normId = normalize(plane.id);

        let matchedStr = "";
        if (normPath.includes(normSafe)) matchedStr = normSafe;
        else if (normPath.includes(normFull)) matchedStr = normFull;
        else if (normPath.includes(normTypeOnly)) matchedStr = normTypeOnly;
        else if (normPath.includes(normId)) matchedStr = normId;

        if (matchedStr && (!bestMatch || matchedStr.length > bestMatch.matchLength)) {
          bestMatch = { safeName, matchLength: matchedStr.length };
        }
      }

      if (!bestMatch) continue;

      const data = entry.getData();
      writeAircraftImage(bestMatch.safeName, ext, data, safeFileName(entryPath), clearedPlanes);

      extractCount++;
      if (!matchedPlanes.includes(bestMatch.safeName)) {
        matchedPlanes.push(bestMatch.safeName);
      }
    }

    return {
      success: true,
      extractedFiles: extractCount,
      matchedPlanesCount: matchedPlanes.length,
      matchedPlanes: matchedPlanes
    };
  }

  const removeTemp = (filePath: string | null) => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error("[upload] Could not remove temp file", unlinkErr);
      }
    }
  };

  const sendError = (res: express.Response, err: any, fallback: string) => {
    const status = err instanceof BadRequest ? 400 : 500;
    if (status === 500) console.error(`[api] ${fallback}`, err);
    res.status(status).json({ success: false, error: err?.message || fallback });
  };

  // REST API Endpoint to upload images zip
  app.post("/api/upload-images-zip", (req, res) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        console.error("[upload] Multer error", err);
        return res.status(400).json({ success: false, error: `Upload failed: ${err.message || "invalid file"}` });
      }

      const filePath = req.file ? req.file.path : null;
      try {
        if (!req.file || !filePath) {
          return res.status(400).json({ success: false, error: "No file provided." });
        }
        const result = await processZipFile(filePath);
        res.json(result);
      } catch (e: any) {
        sendError(res, e, "Failed to process the ZIP archive.");
      } finally {
        removeTemp(filePath);
      }
    });
  });

  /**
   * Downloads a ZIP, but only over https, only from the allow-listed hosts
   * (checked again on every redirect), within a time and size limit.
   */
  async function downloadZip(rawUrl: string, destination: string) {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequest("That is not a valid URL.");
    }

    // Google Drive share links are turned into direct download links.
    const fileId = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.searchParams.get("id");
    if (fileId && /^[a-zA-Z0-9_-]+$/.test(fileId)) {
      url = new URL(`https://drive.google.com/uc?export=download&id=${fileId}`);
    }

    if (url.protocol !== "https:" || !isAllowedDownloadHost(url.hostname)) {
      throw new BadRequest(`Only https links to Google Drive are accepted (got ${url.hostname}).`);
    }

    const request = (target: string, responseType: "stream" | "text") => axios.get(target, {
      responseType,
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxRedirects: 5,
      maxContentLength: MAX_UPLOAD_BYTES,
      validateStatus: () => true,
      beforeRedirect: (options: { hostname?: string; protocol?: string }) => {
        if (options.protocol !== "https:" || !options.hostname || !isAllowedDownloadHost(options.hostname)) {
          throw new BadRequest(`Refusing redirect to ${options.hostname}.`);
        }
      }
    });

    let response = await request(url.toString(), "stream");
    if (response.status !== 200) {
      throw new BadRequest(`The URL could not be loaded (status ${response.status}).`);
    }

    if (fileId && String(response.headers["content-type"] || "").includes("text/html")) {
      // Google Drive shows a virus-scan warning page for large files.
      response.data.destroy?.();
      const textResp = await request(url.toString(), "text");
      const match = typeof textResp.data === "string" ? textResp.data.match(/confirm=([a-zA-Z0-9_-]+)/) : null;
      if (!match) {
        throw new BadRequest("Google Drive requires a manual confirmation. Upload the ZIP directly instead.");
      }
      url.searchParams.set("confirm", match[1]);
      response = await request(url.toString(), "stream");
      if (response.status !== 200) {
        throw new BadRequest(`The URL could not be loaded (status ${response.status}).`);
      }
    }

    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(destination);
      let received = 0;
      response.data.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_UPLOAD_BYTES) {
          response.data.destroy(new BadRequest(`The download exceeds ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`));
        }
      });
      response.data.on("error", reject);
      writer.on("error", reject);
      writer.on("finish", () => resolve());
      response.data.pipe(writer);
    });
  }

  // REST API Endpoint to fetch ZIP from URL (e.g., Google Drive)
  app.post("/api/fetch-images-zip-url", async (req, res) => {
    const tempPath = path.join(uploadDir, `download-${Date.now()}.zip`);
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== "string") {
        return res.status(400).json({ success: false, error: "No URL provided." });
      }

      await downloadZip(url, tempPath);
      const result = await processZipFile(tempPath);
      res.json(result);
    } catch (err: any) {
      sendError(res, err, "Failed to download and process the ZIP archive.");
    } finally {
      removeTemp(tempPath);
    }
  });

  // REST API Endpoint to upload a single image for a specific aircraft type
  app.post("/api/upload-single-image", (req, res) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        console.error("[upload] Multer error", err);
        return res.status(400).json({ success: false, error: `Upload failed: ${err.message || "invalid file"}` });
      }

      const filePath = req.file ? req.file.path : null;
      const aircraftSafeName = req.body?.aircraftSafeName;

      try {
        if (!req.file || !filePath) {
          return res.status(400).json({ success: false, error: "No file provided." });
        }
        // Only folder names of real aircraft are accepted, which also rules out
        // "..", slashes and absolute paths.
        if (typeof aircraftSafeName !== "string" || !KNOWN_SAFE_NAMES.has(aircraftSafeName)) {
          return res.status(400).json({ success: false, error: "Unknown aircraft type." });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
          return res.status(400).json({ success: false, error: "Unsupported file type. Allowed: PNG, JPG, JPEG, WEBP." });
        }

        const filename = writeAircraftImage(aircraftSafeName, ext, fs.readFileSync(filePath), safeFileName(req.file.originalname));

        res.json({
          success: true,
          aircraftSafeName: aircraftSafeName,
          filename: filename
        });
      } catch (e: any) {
        sendError(res, e, "Failed to store the image.");
      } finally {
        removeTemp(filePath);
      }
    });
  });

  // Global JSON-based API Error handler to catch all errors in /api routes and prevent html leakage
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[api] Unhandled error", err);
    res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.message || "Internal server error"
    });
  });

  // Vite development middleware vs production static files.
  // Vite is a dev-only dependency, so it is imported lazily and never loaded in production.
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

// A failure to start (port in use, Vite config error) used to be an unhandled
// rejection with an unclear exit; say what happened and exit non-zero.
startServer().catch((err) => {
  console.error("[Server] Failed to start", err);
  process.exit(1);
});
