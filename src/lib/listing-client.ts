import type { User } from "firebase/auth";
export async function changeListing(
  user: User,
  id: string,
  input: Record<string, unknown>,
) {
  const response = await fetch(`/api/listings/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Unable to update listing.");
  return result as {
    status: string;
    slug: string;
    firstPublish?: boolean;
    cleanupPending?: boolean;
    warning?: string;
  };
}
