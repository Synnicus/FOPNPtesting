import { Readable } from "node:stream";
import { Router, type IRouter } from "express";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

router.get("/storage/public-objects/vault-radio/:fileName", async (req, res) => {
  const fileName = req.params.fileName;
  if (!fileName || fileName.includes("/") || fileName === "." || fileName === "..") {
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
