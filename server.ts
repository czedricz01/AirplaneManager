import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import AdmZip from "adm-zip";
import { aircraftList } from "./src/data/aircraft";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable generous limits for base64 image uploads and ZIP files up to 200mb
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ limit: "200mb", extended: true }));

  // ALWAYS serve /PlanePics directly from the actual public/PlanePics directory on disk 
  // to prevent any static build/compilation caching or losing uploaded files!
  app.use("/PlanePics", express.static(path.join(process.cwd(), "public", "PlanePics")));

  // Multer config using disk-storage to prevent high memory/OOM crashes on large ZIP files
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const upload = multer({ 
    dest: uploadDir,
    limits: { fileSize: 200 * 1024 * 1024 } // 200 Megabytes limit
  });

  // Get active images map for all aircrafts
  app.get("/api/aircraft-images", (req, res) => {
    try {
      const map: Record<string, string> = {};
      const planesDir = path.join(process.cwd(), "public", "PlanePics");
      
      if (fs.existsSync(planesDir)) {
        const folders = fs.readdirSync(planesDir);
        for (const folder of folders) {
          const folderPath = path.join(planesDir, folder);
          if (fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath);
            // Look for best match image
            let bestFile = files.find(f => f === "image.png") ||
                           files.find(f => f === "image.jpg") ||
                           files.find(f => f === "image.jpeg") ||
                           files.find(f => f === "image.webp") ||
                           files.find(f => f === "image.svg") ||
                           files.find(f => f.match(/\.(png|jpg|jpeg|webp|svg)$/i));
            
            if (bestFile) {
              map[folder] = `/PlanePics/${encodeURIComponent(folder)}/${bestFile}`;
            }
          }
        }
      }
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  async function processZipFile(filePath: string) {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    
    let extractCount = 0;
    const matchedPlanes: string[] = [];
    const clearedPlanes = new Set<string>();

    const normalize = (str: string) => {
      return str.toLowerCase().replace(/[^a-z0-9]/g, "");
    };

    for (const entry of zipEntries) {
      if (entry.isDirectory) continue;

      const entryPath = entry.entryName;
      const ext = path.extname(entryPath).toLowerCase();
      
      if (![".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) continue;

      let bestMatch: { safeName: string; matchLength: number } | null = null;
      const normPath = normalize(entryPath);

      for (const plane of aircraftList) {
        const fullName = plane.manufacturer + " " + plane.type;
        const safeName = fullName.split("/").join("-").split("\\").join("-");
        
        const normSafe = normalize(safeName);
        const normFull = normalize(fullName);
        const normTypeOnly = normalize(plane.type);
        const normId = normalize(plane.id);

        let matchedStr = "";
        if (normPath.includes(normSafe)) matchedStr = normSafe;
        else if (normPath.includes(normFull)) matchedStr = normFull;
        else if (normPath.includes(normTypeOnly)) matchedStr = normTypeOnly;
        else if (normPath.includes(normId)) matchedStr = normId;

        if (matchedStr) {
          if (!bestMatch || matchedStr.length > bestMatch.matchLength) {
            bestMatch = { safeName: safeName, matchLength: matchedStr.length };
          }
        }
      }

      const matchedSafeName = bestMatch ? bestMatch.safeName : null;

      if (matchedSafeName) {
        const publicDestDir = path.join(process.cwd(), "public", "PlanePics", matchedSafeName);
        const srcDestDir = path.join(process.cwd(), "src", "PlanePics", matchedSafeName);

        if (!clearedPlanes.has(matchedSafeName)) {
          clearedPlanes.add(matchedSafeName);
          for (const dir of [publicDestDir, srcDestDir]) {
            if (fs.existsSync(dir)) {
              try {
                const existingFiles = fs.readdirSync(dir);
                for (const existingFile of existingFiles) {
                  const fPath = path.join(dir, existingFile);
                  if (fs.statSync(fPath).isFile()) fs.unlinkSync(fPath);
                }
              } catch (e) {
                console.error(`[Zip Clean] Failed to clear pre-existing folder ${dir}:`, e);
              }
            }
          }
        }

        if (!fs.existsSync(publicDestDir)) fs.mkdirSync(publicDestDir, { recursive: true });
        if (!fs.existsSync(srcDestDir)) fs.mkdirSync(srcDestDir, { recursive: true });

        const filename = `image${ext}`;
        const data = entry.getData();
        
        fs.writeFileSync(path.join(publicDestDir, filename), data);
        fs.writeFileSync(path.join(srcDestDir, filename), data);

        const originalName = path.basename(entryPath);
        if (originalName !== filename) {
          fs.writeFileSync(path.join(publicDestDir, originalName), data);
          fs.writeFileSync(path.join(srcDestDir, originalName), data);
        }

        extractCount++;
        if (!matchedPlanes.includes(matchedSafeName)) {
          matchedPlanes.push(matchedSafeName);
        }
      }
    }

    return {
      success: true,
      extractedFiles: extractCount,
      matchedPlanesCount: matchedPlanes.length,
      matchedPlanes: matchedPlanes
    };
  }

  // REST API Endpoint to upload images zip
  app.post("/api/upload-images-zip", (req, res, next) => {
    upload.single("file")(req, res, async (err: any) => {
      if (err) {
        console.error("[Multer Upload Error]", err);
        return res.status(400).json({ 
          success: false, 
          error: `Hochlade-Fehler: ${err.message || "Ungültiges Format oder ungültige Datei"}` 
        });
      }
      
      const filePath = req.file ? req.file.path : null;
      
      try {
        if (!req.file || !filePath) {
          return res.status(400).json({ success: false, error: "Keine Datei bereitgestellt" });
        }

        const result = await processZipFile(filePath);
        res.json(result);
      } catch (err: any) {
        console.error("[Upload Zip Error]", err);
        res.status(500).json({ success: false, error: err.message || "Failed to process zip archive" });
      } finally {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (unlinkErr) {
            console.error("[Upload Clean Err]", unlinkErr);
          }
        }
      }
    });
  });

  // REST API Endpoint to fetch ZIP from URL (e.g., Google Drive)
  app.post("/api/fetch-images-zip-url", async (req, res, next) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, error: "Keine URL bereitgestellt" });
      }

      let fileId = "";
      // Check if it's a Google Drive link
      const gdriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      if (gdriveMatch) {
         fileId = gdriveMatch[1];
      }

      let downloadUrl = url;
      if (fileId) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      }

      console.log(`[Fetch URL] Getting: ${downloadUrl}`);
      let response = await axios.get(downloadUrl, { responseType: 'stream', validateStatus: () => true });
      
      if (response.status !== 200) {
        return res.status(400).json({ success: false, error: `URL konnte nicht geladen werden. Status: ${response.status}` });
      }

      if (fileId && String(response.headers['content-type'] || '').includes('text/html')) {
         // We might be hitting the virus warning page
         console.log("[Fetch URL] Received HTML from Google Drive, attempting to extract confirm token...");
         const textResp = await axios.get(downloadUrl, { responseType: 'text' });
         const match = textResp.data.match(/confirm=([a-zA-Z0-9_-]+)/);
         if (match) {
            const confirmToken = match[1];
            downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmToken}`;
            console.log(`[Fetch URL] Retrying with confirm token: ${downloadUrl}`);
            response = await axios.get(downloadUrl, { responseType: 'stream' });
         } else {
            return res.status(400).json({ success: false, error: "Google Drive verlangt eine manuelle Bestätigung. Bitte setze den Ordner auf Supabase oder lade die ZIP lokal hoch." });
         }
      }

      const uploadDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      
      const tempPath = path.join(uploadDir, `download-${Date.now()}.zip`);
      const writer = fs.createWriteStream(tempPath);
      
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(true));
        writer.on('error', reject);
      });

      console.log(`[Fetch URL] Download complete. Processing ZIP: ${tempPath}`);
      
      // Process extracted ZIP
      const result = await processZipFile(tempPath);
      
      // Clean up temp file
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (err) {
        console.error("[Fetch URL Clean] Error:", err);
      }
      
      res.json(result);
    } catch (err: any) {
      console.error("[Fetch URL Error]", err);
      res.status(500).json({ success: false, error: err.message || "Failed to download and process zip archive from URL" });
    }
  });

  // REST API Endpoint to upload a single image for a specific aircraft type
  app.post("/api/upload-single-image", (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        console.error("[Multer Upload Single Error]", err);
        return res.status(400).json({ 
          success: false, 
          error: `Hochlade-Fehler: ${err.message || "Ungültiges Format oder ungültige Datei"}` 
        });
      }
      
      const filePath = req.file ? req.file.path : null;
      const aircraftSafeName = req.body.aircraftSafeName;

      try {
        if (!req.file || !filePath) {
          return res.status(400).json({ success: false, error: "Keine Datei bereitgestellt" });
        }
        if (!aircraftSafeName) {
          return res.status(400).json({ success: false, error: "Kein Flugzeugtyp angegeben" });
        }

        const ext = path.extname(req.file.originalname).toLowerCase();
        if (![".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext)) {
          return res.status(400).json({ success: false, error: "Ungültiges Dateiformat. Erlaubt sind PNG, JPG, JPEG, WEBP, SVG." });
        }

        // Dest paths
        const publicDestDir = path.join(process.cwd(), "public", "PlanePics", aircraftSafeName);
        const srcDestDir = path.join(process.cwd(), "src", "PlanePics", aircraftSafeName);

        // ALWAYS replace the old files: clean up existing files in the destination directories
        for (const dir of [publicDestDir, srcDestDir]) {
          if (fs.existsSync(dir)) {
            try {
              const existingFiles = fs.readdirSync(dir);
              for (const existingFile of existingFiles) {
                const fPath = path.join(dir, existingFile);
                if (fs.statSync(fPath).isFile()) {
                  fs.unlinkSync(fPath);
                }
              }
            } catch (e) {
              console.error(`[Single Clean] Failed to clear pre-existing folder ${dir}:`, e);
            }
          } else {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        const filename = `image${ext}`;
        const fileData = fs.readFileSync(filePath);
        
        fs.writeFileSync(path.join(publicDestDir, filename), fileData);
        fs.writeFileSync(path.join(srcDestDir, filename), fileData);

        // Also save with original name just in case reference is specific
        const originalName = path.basename(req.file.originalname);
        if (originalName !== filename) {
          fs.writeFileSync(path.join(publicDestDir, originalName), fileData);
          fs.writeFileSync(path.join(srcDestDir, originalName), fileData);
        }

        res.json({
          success: true,
          aircraftSafeName: aircraftSafeName,
          filename: filename
        });
      } catch (err: any) {
        console.error("[Upload Single Image Error]", err);
        res.status(500).json({ success: false, error: err.message || "Fehler beim Verarbeiten des Bildpfads" });
      } finally {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (unlinkErr) {
            console.error("[Upload Single Clean Err]", unlinkErr);
          }
        }
      }
    });
  });

  // Global JSON-based API Error handler to catch all errors in /api routes and prevent html leakage
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Global api error caught]", err);
    res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.message || "Internal Server Error in dynamic API endpoint"
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

startServer();
