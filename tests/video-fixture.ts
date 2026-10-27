import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Firestore } from "firebase-admin/firestore";
import type { Bucket } from "@google-cloud/storage";
import type { RunningVideo } from "../src/lib/running-video";
export async function generateTestVideo(
  file: string,
  duration = 16,
  audio = true,
) {
  await promisify(execFile)(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=128x96:r=10",
      ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440"] : []),
      "-t",
      String(duration),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      ...(audio ? ["-c:a", "aac"] : []),
      "-y",
      file,
    ],
    { timeout: 30000, windowsHide: true },
  );
}
// Trusted fixtures for lifecycle tests; actual file validation is exercised separately.
export async function seedReadyVideo(
  db: Firestore,
  id: string,
  uid: string,
  bucket: Bucket,
) {
  const video: RunningVideo = {
    id: "test-ready",
    path: `listing-videos/${uid}/${id}/test-ready.mp4`,
    uploaderId: uid,
    listingId: id,
    status: "ready",
    contentType: "video/mp4",
    size: 10000,
    duration: 16,
    width: 128,
    height: 96,
    hasAudio: true,
    demonstration: "petrol",
    validatedAt: Date.now(),
    validationVersion: 1,
    generation: "1",
  };
  await bucket
    .file(video.path)
    .save(Buffer.alloc(video.size), { metadata: { contentType: "video/mp4" } });
  const [metadata] = await bucket.file(video.path).getMetadata();
  video.generation = String(metadata.generation);
  await db.doc(`listings/${id}/videos/test-ready`).set(video);
  return video;
}
