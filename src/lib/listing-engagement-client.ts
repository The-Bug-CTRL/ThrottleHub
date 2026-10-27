import type { User } from "firebase/auth";
import type { EngagementEvent } from "./listing-engagement";
export async function trackListing(
  id: string,
  event: EngagementEvent,
  user: User | null,
) {
  const response = await fetch(
    `/api/listings/${encodeURIComponent(id)}/engagement`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(user
          ? { Authorization: "Bearer " + (await user.getIdToken()) }
          : {}),
      },
      body: JSON.stringify({ event }),
      credentials: "same-origin",
      keepalive: true,
    },
  );
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Please try again.");
  return result as { phone?: string };
}
