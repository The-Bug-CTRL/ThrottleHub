import { z } from "zod";
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z
    .string()
    .trim()
    .min(20, "Please describe your experience in at least 20 characters.")
    .max(2000),
});
export interface MemberReview {
  id: string;
  authorId: string;
  authorName: string;
  subjectId: string;
  listingId: string;
  listingTitle: string;
  conversationId: string;
  role: "buyer" | "seller";
  rating: number;
  body: string;
  status: "published" | "hidden";
  createdAt: number;
  updatedAt: number;
  response: string;
}
export interface ReviewSummary {
  count: number;
  average: number;
  distribution: number[];
}
export const emptyReviewSummary: ReviewSummary = {
  count: 0,
  average: 0,
  distribution: [0, 0, 0, 0, 0],
};
export function reviewSummary(distribution: number[]): ReviewSummary {
  const count = distribution.reduce((total, value) => total + value, 0);
  const total = distribution.reduce(
    (sum, value, index) => sum + value * (index + 1),
    0,
  );
  return { count, average: count ? total / count : 0, distribution };
}
