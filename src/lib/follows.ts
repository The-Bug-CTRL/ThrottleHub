import {
  doc,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
export async function setFollowing(
  db: Firestore,
  follower: string,
  target: string,
  follow: boolean,
) {
  if (!follower || !target || follower === target)
    throw new Error("Choose another rider to follow.");
  const outgoing = doc(db, "profiles", follower, "following", target);
  const incoming = doc(db, "profiles", target, "followers", follower);
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(outgoing);
    if (existing.exists() === follow) return;
    if (follow) {
      tx.set(outgoing, { createdAt: serverTimestamp() });
      tx.set(incoming, { createdAt: serverTimestamp() });
    } else {
      tx.delete(outgoing);
      tx.delete(incoming);
    }
  });
}
