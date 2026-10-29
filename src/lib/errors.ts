export function dataError(error: unknown): string {
  const code = (error as { code?: string | number })?.code;
  if (
    code === "permission-denied" ||
    code === "auth/unauthorized-domain" ||
    code === 7
  )
    return "Access denied. Your account does not have permission to perform this action.";
  if (
    code === "failed-precondition" ||
    code === "FAILED_PRECONDITION" ||
    code === "firestore/failed-precondition" ||
    code === 9
  ) {
    const message = error instanceof Error ? error.message : "";
    return /(?:requires?|needs?) an? index|index (?:is not ready|is currently building)/i.test(
      message,
    )
      ? "This content is temporarily unavailable while its search index is prepared. Please retry later."
      : "This request cannot be completed right now. Please retry later.";
  }
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
