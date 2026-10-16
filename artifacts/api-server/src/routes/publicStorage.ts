import { Readable } from "node:stream";
import { Router, type IRouter } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function isValidTrackFileName(fileName: string) {
  return Boolean(
    fileName
    && !fileName.includes("/")
    && !fileName.includes("\\")
    && fileName !== "."
    && fileName !== "..",
  );
}

router.get("/storage/public-objects/vault-radio", async (_req, res) => {
  try {
    const tracks = (await objectStorage.listPublicObjects("vault-radio/"))
      .filter(fileName => /\.(mp3|oga|ogg|m4a|wav)$/i.test(fileName))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }));
    res.json({ tracks });
  } catch (error) {
    console.error("Unable to list public Vault Radio tracks from App Storage.", error);
    res.status(500).json({ error: "Unable to list Vault Radio tracks" });
  }
});

router.head("/storage/public-objects/vault-radio/:fileName", async (req, res) => {
  const fileName = req.params.fileName;
  if (!isValidTrackFileName(fileName)) {
    res.status(400).json({ error: "Invalid public asset path" });
    return;
  }

  try {
    const file = await objectStorage.searchPublicObject(`vault-radio/${fileName}`);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", (metadata.contentType as string) || "application/octet-stream");
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.status(200).end();
  } catch (error) {
    console.error("Unable to inspect public Vault Radio track in App Storage.", error);
    res.status(500).json({ error: "Unable to inspect Vault Radio track" });
  }
});

router.get("/storage/public-objects/vault-radio/:fileName", async (req, res) => {
  const fileName = req.params.fileName;
  if (!isValidTrackFileName(fileName)) {
    res.status(400).json({ error: "Invalid public asset path" });
    return;
  }

  try {
    const filePath = `vault-radio/${fileName}`;
    const file = await objectStorage.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorage.downloadObject(file, 86400);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error("Unable to serve public asset from App Storage.", error);
    res.status(500).json({ error: "Unable to serve public asset" });
  }
});

export default router;
