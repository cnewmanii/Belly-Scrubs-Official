import type { Express, Request, Response } from "express";
import multer from "multer";
import sharp from "sharp";
import { storage } from "../storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export function registerAdminRoutes(app: Express) {
  // Public: returns all hero photos with full base64 data
  app.get("/api/hero-photos", async (_req: Request, res: Response) => {
    try {
      const photos = await storage.getHeroPhotos();
      res.json(photos);
    } catch (err) {
      console.error("Hero photos fetch error:", err);
      res.status(500).json({ error: "Failed to fetch hero photos" });
    }
  });

  // Admin: list hero photos (id + caption only, no base64 payload)
  app.get("/api/admin/hero-photos", async (_req: Request, res: Response) => {
    try {
      const photos = await storage.getHeroPhotos();
      res.json(photos.map((p) => ({ id: p.id, caption: p.caption, createdAt: p.createdAt })));
    } catch (err) {
      console.error("Admin hero photos list error:", err);
      res.status(500).json({ error: "Failed to list hero photos" });
    }
  });

  // Admin: upload a new hero photo
  app.post("/api/admin/hero-photos", upload.single("photo"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No photo file provided" });
      }

      // Get original dimensions for logging
      const originalMeta = await sharp(req.file.buffer).metadata();
      console.log(`HERO UPLOAD: Original ${originalMeta.width}x${originalMeta.height} (${(req.file.buffer.length / 1024).toFixed(0)}KB)`);

      // Resize to max 1920x1080, convert to JPEG at 85% quality
      const resizedBuffer = await sharp(req.file.buffer)
        .resize(1920, 1080, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const resizedMeta = await sharp(resizedBuffer).metadata();
      console.log(`HERO UPLOAD: Resized ${resizedMeta.width}x${resizedMeta.height} (${(resizedBuffer.length / 1024).toFixed(0)}KB)`);

      const base64 = resizedBuffer.toString("base64");
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      const caption = (req.body.caption as string) || undefined;
      const photo = await storage.createHeroPhoto(dataUrl, caption);
      res.json({ id: photo.id, caption: photo.caption, createdAt: photo.createdAt });
    } catch (err) {
      console.error("Hero photo upload error:", err);
      res.status(500).json({ error: "Failed to upload hero photo" });
    }
  });

  // Admin: delete a hero photo
  app.delete("/api/admin/hero-photos/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      await storage.deleteHeroPhoto(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Hero photo delete error:", err);
      res.status(500).json({ error: "Failed to delete hero photo" });
    }
  });
}
