import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sanitizePhoto } from "./photo-service";
import { cleanVideoContainer } from "./video-inspection";
import { forumLimit } from "./forum-media-model";
const run = promisify(execFile);
export async function processForumMedia(bytes: Buffer, kind: string) {
  if (!bytes.length || bytes.length > forumLimit(kind))
    throw Error("File exceeds the upload limit.");
  if (kind === "photo")
    return {
      bytes: await sanitizePhoto(bytes),
      type: "image/jpeg",
      extension: "jpg",
    };
  if (kind === "gif") {
    if (!["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)))
      throw Error("Choose a genuine GIF file.");
    const options = {
      animated: true,
      limitInputPixels: 20_000_000,
      failOn: "warning" as const,
    };
    const meta = await sharp(bytes, options).metadata();
    const frames = meta.pages || 1,
      width = meta.width || 0,
      height = meta.pageHeight || meta.height || 0;
    const duration = (meta.delay || [100]).reduce(
      (sum, delay) => sum + Math.max(delay, 20),
      0,
    );
    if (
      !width ||
      !height ||
      width > 1280 ||
      height > 1280 ||
      frames > 100 ||
      frames * width * height > 20_000_000 ||
      duration > 10000
    )
      throw Error(
        "GIFs must be at most 100 frames, 10 seconds and 20 million total pixels (1280px per side).",
      );
    const output = await sharp(bytes, options)
      .resize({
        width: 640,
        height: 640,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75, effort: 3, loop: 0 })
      .timeout({ seconds: 20 })
      .toBuffer();
    if (output.length > 8 * 1024 * 1024)
      throw Error("Processed animation is too large.");
    return { bytes: output, type: "image/webp", extension: "webp" };
  }
  if (kind !== "video" || bytes.toString("ascii", 4, 8) !== "ftyp")
    throw Error(
      "Use an MP4 H.264 video. HEVC, MOV and other phone formats must be exported as H.264 MP4 first.",
    );
  const folder = await mkdtemp(
    path.join(
      Reflect.apply(tmpdir, undefined, []) as string,
      "throttlehub-forum-",
    ),
  );
  try {
    const input = path.join(folder, "input.mp4"),
      output = path.join(folder, "clean.mp4");
    await writeFile(input, bytes);
    const { stdout } = await run(
      process.env.FFPROBE_PATH || "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_format",
        "-show_streams",
        "-of",
        "json",
        input,
      ],
      { timeout: 15000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const probe = JSON.parse(stdout),
      streams = probe.streams as {
        codec_type: string;
        codec_name: string;
        pix_fmt?: string;
        width?: number;
        height?: number;
        avg_frame_rate?: string;
      }[];
    const video = streams.filter((s) => s.codec_type === "video"),
      audio = streams.filter((s) => s.codec_type === "audio");
    const v = video[0],
      duration = Number(probe.format?.duration),
      rate = (v?.avg_frame_rate || "0/1").split("/").map(Number),
      fps = rate[0] / rate[1];
    if (
      video.length !== 1 ||
      !v ||
      v.codec_name !== "h264" ||
      !["yuv420p", "yuvj420p"].includes(v.pix_fmt || "") ||
      !(duration > 0 && duration <= 60) ||
      !(fps > 0 && fps <= 60) ||
      !(Number(v.width) >= 16 && Number(v.height) >= 16) ||
      Math.max(Number(v.width), Number(v.height)) > 1920 ||
      Math.min(Number(v.width), Number(v.height)) > 1080 ||
      audio.length > 1 ||
      audio.some((s) => s.codec_name !== "aac") ||
      streams.length !== video.length + audio.length
    )
      throw Error(
        "Use a video up to 60 seconds, 1080p and 60fps: MP4 H.264, standard colour, optional AAC audio.",
      );
    await run(
      process.env.FFMPEG_PATH || "ffmpeg",
      [
        "-v",
        "error",
        "-xerror",
        "-nostdin",
        "-threads",
        "2",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        input,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-f",
        "null",
        "-",
      ],
      { timeout: 90000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    await cleanVideoContainer(input, output);
    const clean = await readFile(output);
    if (clean.length > forumLimit("video"))
      throw Error("Processed video exceeds 50 MiB.");
    return { bytes: clean, type: "video/mp4", extension: "mp4" };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
