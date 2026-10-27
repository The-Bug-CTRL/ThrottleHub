import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { open } from "node:fs/promises";
const run = promisify(execFile);
export async function inspectRunningVideo(
  file: string,
  demonstration: "petrol" | "electric",
) {
  const handle = await open(file, "r");
  const header = Buffer.alloc(12);
  try {
    await handle.read(header, 0, 12, 0);
  } finally {
    await handle.close();
  }
  if (header.toString("ascii", 4, 8) !== "ftyp")
    throw Error("Use an MP4 video, not a renamed file.");
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
      file,
    ],
    { timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true },
  );
  const probe = JSON.parse(stdout);
  const streams = probe.streams || [],
    video = streams.filter(
      (s: { codec_type: string }) => s.codec_type === "video",
    ),
    audio = streams.filter(
      (s: { codec_type: string }) => s.codec_type === "audio",
    );
  const duration = Number(probe.format?.duration);
  if (
    video.length !== 1 ||
    video[0].codec_name !== "h264" ||
    !["yuv420p", "yuvj420p"].includes(video[0].pix_fmt) ||
    streams.some(
      (s: { codec_type: string }) => !["video", "audio"].includes(s.codec_type),
    )
  )
    throw Error(
      "Use MP4 with H.264 video, standard colour and AAC audio. Other formats are not supported yet.",
    );
  const width = Number(video[0].width),
    height = Number(video[0].height);
  if (
    !(duration >= 15 && duration <= 60) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    Math.min(width, height) > 720 ||
    Math.max(width, height) > 1280 ||
    width < 16 ||
    height < 16
  )
    throw Error(
      "Use a 15–60 second video at 720p or below, in portrait or landscape.",
    );
  if (
    audio.length > 1 ||
    audio.some((s: { codec_name: string }) => s.codec_name !== "aac") ||
    (demonstration === "petrol" && audio.length !== 1)
  )
    throw Error(
      "Petrol demonstrations need an AAC audio track. Electric demonstrations may be silent.",
    );
  // Decode the entire bounded file, not just its filename/MIME/header. No transcoding.
  await run(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-v",
      "error",
      "-xerror",
      "-nostdin",
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-f",
      "null",
      "-",
    ],
    { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true },
  );
  return { duration, width, height, hasAudio: audio.length === 1 };
}
export async function cleanVideoContainer(input: string, output: string) {
  // Stream-copy supported codecs: no expensive re-encoding. Drop container tags/GPS/chapters.
  await run(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-v",
      "error",
      "-xerror",
      "-nostdin",
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-map_metadata",
      "-1",
      "-map_chapters",
      "-1",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      output,
    ],
    { timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true },
  );
}
