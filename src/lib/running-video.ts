export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_VALIDATION_VERSION = 1;
export interface RunningVideo {
  id: string;
  path: string;
  uploaderId: string;
  listingId: string;
  status: "ready";
  contentType: "video/mp4";
  size: number;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  demonstration: "petrol" | "electric";
  validatedAt: number;
  uploadedAt?: number;
  validationVersion: number;
  generation: string;
}
export function videoIsReady(
  video: Partial<RunningVideo> | null | undefined,
  owner: string,
  listingId: string,
): video is RunningVideo {
  return (
    !!video &&
    video.status === "ready" &&
    video.uploaderId === owner &&
    video.listingId === listingId &&
    video.validationVersion === VIDEO_VALIDATION_VERSION &&
    video.contentType === "video/mp4" &&
    typeof video.id === "string" &&
    /^[a-zA-Z0-9_-]{1,128}$/.test(video.id) &&
    video.path === `listing-videos/${owner}/${listingId}/${video.id}.mp4` &&
    typeof video.duration === "number" &&
    video.duration >= 15 &&
    video.duration <= 60 &&
    typeof video.size === "number" &&
    video.size > 0 &&
    video.size <= MAX_VIDEO_BYTES &&
    typeof video.width === "number" &&
    typeof video.height === "number" &&
    video.width >= 16 &&
    video.height >= 16 &&
    Math.min(video.width, video.height) <= 720 &&
    Math.max(video.width, video.height) <= 1280 &&
    (video.demonstration === "electric" ||
      (video.demonstration === "petrol" && video.hasAudio === true)) &&
    typeof video.generation === "string" &&
    /^[0-9]+$/.test(video.generation)
  );
}
