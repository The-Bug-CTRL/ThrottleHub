import { text, contentMillis } from "./imported-content";
import { sharedVideo } from "./shared-video";
function youtubeResource(value: unknown, id: string, embed = false) {
  try {
    const url = new URL(text(value, 2048));
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return "";
    if (embed)
      return ["www.youtube-nocookie.com", "youtube-nocookie.com"].includes(
        url.hostname,
      ) && url.pathname === `/embed/${id}`
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : "";
    const video = sharedVideo(url.href);
    return video?.provider === "YouTube" &&
      video.embedUrl === `https://www.youtube-nocookie.com/embed/${id}`
      ? `https://www.youtube.com/watch?v=${id}`
      : "";
  } catch {
    return "";
  }
}
export function importedVideo(id: string, d: Record<string, unknown>) {
  if (
    d.kind !== "youtube" ||
    d.status !== "published" ||
    d.manuallyHidden === true
  )
    return null;
  const videoId = text(d.videoId, 80),
    title = text(d.title, 300),
    publishedAt = contentMillis(d.publishedAt);
  if (
    !/^[a-zA-Z0-9_-]{11}$/.test(videoId) ||
    !title ||
    publishedAt === null ||
    !Number.isFinite(new Date(publishedAt).getTime())
  )
    return null;
  const url = youtubeResource(d.url, videoId);
  if (!url) return null;
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return {
    id,
    videoId,
    title,
    url,
    embedUrl: youtubeResource(d.embedUrl, videoId, true) || null,
    thumbnailUrl: d.thumbnailUrl === thumbnail ? thumbnail : null,
    channelName: text(d.channelName, 160),
    category: text(d.category, 100),
    publishedAt,
  };
}
export type ImportedVideo = NonNullable<ReturnType<typeof importedVideo>>;
