import { Readable } from "node:stream";
import { adminDb } from "@/lib/server";
import {
  forumBucket,
  forumIdentity,
  forumOrigin,
  forumFailure,
} from "@/lib/forum-api";
import { boundedBytes, boundedText } from "@/lib/request-body";
import { forumId, forumLimit } from "@/lib/forum-media-model";
import { processForumMedia } from "@/lib/forum-media-processing";
import {
  ForumError,
  beginForumMedia,
  claimForumUpload,
  releaseForumUpload,
  saveForumMedia,
  discardForumMedia,
  readableForumMedia,
} from "@/lib/forum-media-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const mediaId = (request: Request) =>
  forumId.parse(new URL(request.url).searchParams.get("id"));
export async function POST(request: Request) {
  try {
    forumOrigin(request);
    const uid = await forumIdentity(request);
    return Response.json(
      await beginForumMedia(
        adminDb(),
        uid,
        JSON.parse(await boundedText(request, 2048)),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return forumFailure(e);
  }
}
export async function PUT(request: Request) {
  let claimed = false,
    id = "";
  try {
    forumOrigin(request);
    const uid = await forumIdentity(request);
    id = mediaId(request);
    const record = await claimForumUpload(adminDb(), uid, id);
    claimed = true;
    const bytes = await boundedBytes(request, forumLimit(record.kind));
    let result;
    try {
      result = await processForumMedia(bytes, record.kind);
    } catch (e) {
      throw new ForumError(
        e instanceof Error && !e.message.includes("Command failed")
          ? e.message.slice(0, 250)
          : "Media could not be decoded. Export a supported file and retry.",
        422,
      );
    }
    await saveForumMedia(adminDb(), forumBucket(), uid, id, result);
    return Response.json(
      { id, kind: record.kind },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (claimed)
      await adminDb()
        .doc(`forumMedia/${id}`)
        .update({ status: "failed" })
        .catch(() => {});
    return forumFailure(e);
  } finally {
    if (claimed) await releaseForumUpload(adminDb(), id);
  }
}
export async function DELETE(request: Request) {
  try {
    forumOrigin(request);
    const uid = await forumIdentity(request);
    await discardForumMedia(adminDb(), forumBucket(), uid, mediaId(request));
    return Response.json({ discarded: true });
  } catch (e) {
    return forumFailure(e);
  }
}
export async function GET(request: Request) {
  try {
    const uid = request.headers.has("authorization")
      ? await forumIdentity(request)
      : undefined;
    const r = await readableForumMedia(adminDb(), mediaId(request), uid);
    const file = forumBucket().file(r.path, { generation: r.generation });
    const [meta] = await file.getMetadata();
    if (
      String(meta.generation) !== r.generation ||
      Number(meta.size) !== r.size ||
      meta.contentType !== r.type
    )
      throw new ForumError("Media unavailable.", 404);
    let start = 0,
      end = r.size - 1;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${r.size}` },
        });
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), end) : end;
      if (!Number.isSafeInteger(start) || start > end || start < 0)
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${r.size}` },
        });
    }
    return new Response(
      Readable.toWeb(file.createReadStream({ start, end })) as ReadableStream,
      {
        status: range ? 206 : 200,
        headers: {
          "Content-Type": r.type,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          ...(range
            ? { "Content-Range": `bytes ${start}-${end}/${r.size}` }
            : {}),
        },
      },
    );
  } catch (e) {
    return forumFailure(e);
  }
}
