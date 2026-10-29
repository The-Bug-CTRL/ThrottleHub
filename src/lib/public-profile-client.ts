export async function fetchPublicProfile(uid: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(`/api/profiles/${encodeURIComponent(uid)}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load this profile.");
  return (await response.json()).profile;
}
