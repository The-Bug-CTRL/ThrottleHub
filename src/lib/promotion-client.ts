import type { User } from "firebase/auth";
export async function promotionRequest(user: User, body?: unknown, query = "") {
  const response = await fetch(`/api/promotions${query}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Promotion request failed.");
  return result;
}
