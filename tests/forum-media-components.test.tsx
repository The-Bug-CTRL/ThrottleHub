import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ForumMedia } from "../src/components/forum-media";
import { sharedVideo } from "../src/lib/shared-video";
it("does not load video or animation bytes until requested and keeps photos lazy", () => {
  const html = renderToStaticMarkup(
    <ForumMedia
      attachments={[
        { id: "photo", kind: "photo" },
        { id: "video", kind: "video" },
        { id: "gif", kind: "gif" },
      ]}
    />,
  );
  expect(html).toContain('loading="lazy"');
  expect(html).toContain("Load video");
  expect(html).toContain("Play GIF");
  expect(html).not.toContain("<video");
  expect(html).not.toContain("id=video");
  expect(html).not.toContain("id=gif");
});
it("allowlists YouTube and legacy Vimeo without arbitrary iframe URLs", () => {
  expect(sharedVideo("https://youtu.be/abcdefghijk")?.embedUrl).toBe(
    "https://www.youtube-nocookie.com/embed/abcdefghijk",
  );
  expect(sharedVideo("https://vimeo.com/123456")?.provider).toBe("Vimeo");
  expect(
    sharedVideo("https://youtube.com.evil.test/watch?v=abcdefghijk"),
  ).toBeNull();
  expect(sharedVideo("javascript:alert(1)")).toBeNull();
});
