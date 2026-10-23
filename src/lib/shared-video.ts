export type SharedVideo = {
  provider: "YouTube" | "Vimeo";
  embedUrl: string;
  url: string;
};
export function sharedVideo(value: string): SharedVideo | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase();
    let id = "";
    if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
      ].includes(host)
    ) {
      id = host.endsWith("youtu.be")
        ? url.pathname.slice(1)
        : url.pathname === "/watch"
          ? url.searchParams.get("v") || ""
          : /^\/(shorts|embed)\//.test(url.pathname)
            ? url.pathname.split("/")[2]
            : "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id)
        ? {
            provider: "YouTube",
            embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
            url: value,
          }
        : null;
    }
    if (["vimeo.com", "www.vimeo.com"].includes(host)) {
      id = url.pathname.slice(1);
      return /^\d{1,12}$/.test(id)
        ? {
            provider: "Vimeo",
            embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`,
            url: value,
          }
        : null;
    }
    return null;
  } catch {
    return null;
  }
}
