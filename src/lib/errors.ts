export function dataError(error: unknown): string {
  const code = (error as { code?: string | number })?.code;
  if (
    code === "permission-denied" ||
    code === "auth/unauthorized-domain" ||
    code === 7
  )
    return "Access denied. Your account does not have permission to perform this action.";
  if (code === "failed-precondition" || code === 9)
    return "This query needs a Firestore index. Check the configured indexes and Firebase error details.";
  if (
    code === "unavailable" ||
    code === "auth/network-request-failed" ||
    code === 14
  )
    return "Firebase connection failed. Check that the configured services are running, then retry.";
  return error instanceof Error
    ? error.message
    : "Firebase request failed. Please retry.";
}
