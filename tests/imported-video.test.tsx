import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { importedVideo } from "../src/lib/imported-video";
import {
  RacingHighlightsCarousel,
  ContentVideoCard,
  VideoPlayback,
} from "../src/components/content-videos";
const id = "aBcdEF_12-3";
const data = {
  kind: "youtube",
  status: "published",
  videoId: id,
  title: "Race highlights",
  url: `https://www.youtube.com/watch?v=${id}`,
  embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  channelName: "Original channel",
  publishedAt: "2026-10-27T10:00:00.000Z",
  category: "Race Highlights",
  editorLocked: true,
  contentHash: "internal",
  channelId: "private-internal",
};
it("projects only eligible public video fields and rejects hidden, unpublished or invalid videos", () => {
  const video = importedVideo("doc", data)!;
  expect(video).toMatchObject({
    videoId: id,
    title: data.title,
    channelName: data.channelName,
    category: data.category,
    thumbnailUrl: data.thumbnailUrl,
    publishedAt: Date.parse(data.publishedAt),
  });
  expect(Object.keys(video)).not.toContain("editorLocked");
  expect(Object.keys(video)).not.toContain("channelId");
  expect(JSON.stringify(video)).not.toContain("internal");
  for (const change of [
    { status: "draft" },
    { manuallyHidden: true },
    { kind: "upload" },
    { videoId: "invalid" },
    { publishedAt: "not a date" },
    { publishedAt: 1e99 },
    { title: "" },
  ])
    expect(importedVideo("doc", { ...data, ...change })).toBeNull();
});
it("rejects URL spoofing, mismatched IDs, credentials and non-HTTPS links", () => {
  for (const url of [
    "javascript:alert(1)",
    `http://youtube.com/watch?v=${id}`,
    `https://youtube.com.evil.test/watch?v=${id}`,
    `https://name:password@youtube.com/watch?v=${id}`,
    "https://www.youtube.com/watch?v=different11",
  ])
    expect(importedVideo("doc", { ...data, url })).toBeNull();
  expect(
    importedVideo("doc", { ...data, url: `https://youtu.be/${id}` })?.url,
  ).toBe(data.url);
  for (const embedUrl of [
    `https://www.youtube.com/embed/${id}`,
    `https://evil.test/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/different11`,
  ])
    expect(importedVideo("doc", { ...data, embedUrl })?.embedUrl).toBeNull();
  expect(
    importedVideo("doc", {
      ...data,
      embedUrl: `${data.embedUrl}?autoplay=1&unknown=unsafe`,
    })?.embedUrl,
  ).toBe(data.embedUrl);
});
it("uses only the matching official thumbnail; missing or unapproved images use the brand fallback", () => {
  for (const thumbnailUrl of [
    null,
    "https://evil.test/image.jpg",
    "https://i.ytimg.com/vi/different11/hqdefault.jpg",
  ]) {
    const video = importedVideo("doc", { ...data, thumbnailUrl })!;
    expect(video.thumbnailUrl).toBeNull();
    const html = renderToStaticMarkup(
      <ContentVideoCard video={video} onPlay={() => {}} />,
    );
    expect(html).toContain("ThrottleHub");
    expect(html).not.toContain("<img");
  }
  const html = renderToStaticMarkup(
    <RacingHighlightsCarousel videos={[importedVideo("doc", data)!]} />,
  );
  expect(html).toContain("hqdefault.jpg");
  expect(html).toContain("Original channel");
  expect(html).toContain("Race Highlights");
  expect(html).toContain('aria-roledescription="carousel"');
});
it("does not create any iframe before playback and uses the privacy-enhanced player with an original-link fallback", () => {
  const video = importedVideo("doc", data)!;
  expect(
    renderToStaticMarkup(<RacingHighlightsCarousel videos={[video]} />),
  ).not.toContain("<iframe");
  const html = renderToStaticMarkup(
    <VideoPlayback video={video} onClose={() => {}} />,
  );
  expect(html).toContain("youtube-nocookie.com/embed/");
  expect(html).toContain("<iframe");
  expect(html).toContain("Open on YouTube");
  expect(html).toContain("embedding has been disabled");
  expect(html).toContain('aria-label="Close video"');
  const unsupported = renderToStaticMarkup(
    <VideoPlayback video={{ ...video, embedUrl: null }} onClose={() => {}} />,
  );
  expect(unsupported).not.toContain("<iframe");
  expect(unsupported).toContain("Open on YouTube");
});
it("does not render an empty carousel or invent videos", () => {
  expect(renderToStaticMarkup(<RacingHighlightsCarousel videos={[]} />)).toBe(
    "",
  );
});
it("provides keyboard guidance, labelled arrow controls and slide positions without automatic playback", () => {
  const html = renderToStaticMarkup(
    <RacingHighlightsCarousel videos={[importedVideo("doc", data)!]} />,
  );
  expect(html).toContain('aria-label="Previous racing videos"');
  expect(html).toContain('aria-label="Next racing videos"');
  expect(html).toContain('aria-roledescription="slide"');
  expect(html).toContain('aria-label="1 of 1"');
  expect(html).toContain('tabindex="0"');
  expect(html).toContain("Home and End");
  expect(
    renderToStaticMarkup(
      <VideoPlayback video={importedVideo("doc", data)!} onClose={() => {}} />,
    ),
  ).not.toContain("autoplay=1");
});
