import { adminDb } from "@/lib/server";
import {
  forumBucket,
  forumIdentity,
  forumOrigin,
  forumFailure,
} from "@/lib/forum-api";
import { boundedText } from "@/lib/request-body";
import { publishForumPost } from "@/lib/forum-media-service";
export async function POST(request: Request) {
  try {
    forumOrigin(request);
    const uid = await forumIdentity(request);
    return Response.json(
      await publishForumPost(
        adminDb(),
        forumBucket(),
        uid,
        JSON.parse(await boundedText(request, 20000)),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return forumFailure(e);
  }
}

import { forumTarget } from "@/lib/forum-media-model";
import { checkForumTarget, ForumError } from "@/lib/forum-media-service";
export async function DELETE(request: Request) {
  try {
    forumOrigin(request);
    const uid = await forumIdentity(request);
    const target = forumTarget.parse(
      JSON.parse(await boundedText(request, 2048)),
    );
    const db = adminDb();
    await db.runTransaction(async (tx) => {
      const post = await checkForumTarget(db, tx, uid, target);
      if (!post.exists) throw new ForumError("Post not found.", 404);
      tx.update(post.ref, {
        status: "deleted",
        body: "[Post removed by its author]",
        updatedAt: Date.now(),
      });
    });
    return Response.json({ removed: true });
  } catch (e) {
    return forumFailure(e);
  }
}
