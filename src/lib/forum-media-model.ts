import { z } from "zod";
export const forumId = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const forumTarget = z
  .object({ threadId: forumId, replyId: forumId.optional() })
  .strict();
export const forumKind = z.enum(["photo", "video", "gif"]);
export type ForumAttachment = { id: string; kind: z.infer<typeof forumKind> };
export const attachmentSchema = z
  .array(z.object({ id: forumId, kind: forumKind }).strict())
  .max(7)
  .superRefine((items, ctx) => {
    if (
      new Set(items.map((a) => a.id)).size !== items.length ||
      items.filter((a) => a.kind === "photo").length > 5 ||
      items.filter((a) => a.kind === "video").length > 1 ||
      items.filter((a) => a.kind === "gif").length > 1
    )
      ctx.addIssue({
        code: "custom",
        message: "Use up to 5 photos, 1 video and 1 GIF.",
      });
  });
export const forumPath = (t: { threadId: string; replyId?: string }) =>
  `forumThreads/${t.threadId}${t.replyId ? `/replies/${t.replyId}` : ""}`;
export const forumLimit = (kind: string) =>
  (kind === "video" ? 50 : 5) * 1024 * 1024;
