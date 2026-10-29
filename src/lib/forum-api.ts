import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { adminDb } from "./server";
import { ForumError } from "./forum-media-service";
import { RequestBodyError } from "./request-body";
import { ZodError } from "zod";
export function forumBucket() {
  const name = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new ForumError("Media storage is not configured.", 503);
  return getStorage().bucket(name);
}
export async function forumIdentity(request: Request) {
  adminDb();
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer "))
    throw new ForumError("Sign in to post.", 401);
  try {
    return (await getAuth().verifyIdToken(header.slice(7), true)).uid;
  } catch {
    throw new ForumError(
      "Your session could not be verified. Sign in again.",
      401,
    );
  }
}
export function forumOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ForumError("Invalid origin.", 403);
}
export function forumFailure(error: unknown) {
  const known =
    error instanceof ForumError || error instanceof RequestBodyError;
  return Response.json(
    {
      error: known
        ? error.message
        : error instanceof ZodError
          ? error.issues[0]?.message
          : "Forum request failed. Please retry.",
    },
    {
      status: known
        ? error.status
        : error instanceof ZodError || error instanceof SyntaxError
          ? 400
          : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
