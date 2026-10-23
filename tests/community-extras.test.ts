import { describe, it, expect } from "vitest";
import { sharedVideo } from "../src/lib/shared-video";
import { directorySchema } from "../src/lib/directory";
import { categoryById } from "../src/lib/taxonomy";
describe("community extras", () => {
  it("recognises shared videos without allowing arbitrary embedded URLs", () => {
    expect(sharedVideo("https://youtu.be/abcdefghijk")?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/abcdefghijk",
    );
    expect(
      sharedVideo("https://www.youtube.com/watch?v=abcdefghijk&t=10")?.provider,
    ).toBe("YouTube");
    expect(
      sharedVideo("https://youtube.com/shorts/abcdefghijk")?.provider,
    ).toBe("YouTube");
    expect(sharedVideo("https://vimeo.com/12345678")?.provider).toBe("Vimeo");
    for (const url of [
      "javascript:alert(1)",
      "https://youtube.com.evil.test/watch?v=abcdefghijk",
      "https://youtube.com:444/watch?v=abcdefghijk",
      "http://youtu.be/abcdefghijk",
      "https://vimeo.com/not-a-video",
      "https://evil.test/embed/video",
    ])
      expect(sharedVideo(url)).toBeNull();
  });
  it("validates directory post types, location and explicit public contact", () => {
    const job = {
      kind: "job",
      title: "Motorcycle workshop mechanic",
      body: "We are looking for a mechanic for our local motorcycle workshop.",
      category: "Workshop & mechanics",
      organisation: "Test workshop",
      region: "ZA-GP",
      city: "Pretoria",
      contactEmail: "jobs@example.test",
      price: 0,
    };
    expect(directorySchema.safeParse(job).success).toBe(true);
    for (const changes of [
      { category: "Race entries" },
      { kind: "unknown" },
      { contactEmail: "private-no-email" },
      { region: "London" },
      { price: -1 },
      { body: "short" },
    ])
      expect(directorySchema.safeParse({ ...job, ...changes }).success).toBe(
        false,
      );
  });
  it("has catch-all accessory, riding gear and workshop categories", () => {
    for (const id of [
      "accessories/other-accessories",
      "riding-gear/other-riding-gear",
      "tools/other-workshop-items",
    ])
      expect(categoryById[id].isActive).toBe(true);
  });
});
