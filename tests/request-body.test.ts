import { it, expect } from "vitest";
import { boundedText, boundedBytes } from "../src/lib/request-body";
it("reads a valid Unicode body within its byte limit", async () => {
  expect(
    await boundedText(
      new Request("http://local", { method: "POST", body: "café" }),
      5,
    ),
  ).toBe("café");
});
it("rejects oversized advertised bodies before reading", async () => {
  await expect(
    boundedText(
      new Request("http://local", {
        method: "POST",
        body: "a",
        headers: { "content-length": "1000" },
      }),
      10,
    ),
  ).rejects.toMatchObject({ status: 413 });
});
it("rejects oversized bodies without a content-length header", async () => {
  await expect(
    boundedText(
      new Request("http://local", { method: "POST", body: "ééé" }),
      5,
    ),
  ).rejects.toMatchObject({ status: 413 });
});

it("preserves binary bytes and bounds chunked photo bodies", async () => {
  const bytes = Buffer.from([0, 255, 128, 1]);
  expect(
    await boundedBytes(
      new Request("http://local", { method: "POST", body: bytes }),
      4,
    ),
  ).toEqual(bytes);
  await expect(
    boundedBytes(
      new Request("http://local", { method: "POST", body: bytes }),
      3,
    ),
  ).rejects.toMatchObject({ status: 413 });
  await expect(
    boundedBytes(
      new Request("http://local", {
        method: "POST",
        body: bytes,
        headers: { "content-length": "100" },
      }),
      4,
    ),
  ).rejects.toMatchObject({ status: 413 });
});
