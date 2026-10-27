import type { User } from "firebase/auth";
export async function accountProfile(
  user: User,
  input?: unknown,
  edit = false,
) {
  const response = await fetch("/api/account/profile", {
    method: input === undefined ? "GET" : edit ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${await user.getIdToken()}`,
      "Content-Type": "application/json",
    },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "Unable to load your profile.");
  return result;
}
