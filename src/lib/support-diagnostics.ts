// Never log token headers, user IDs, guest keys, document data or raw error messages.
export function supportDiagnostic(stage: string, error: unknown) {
  const e = error as { code?: unknown; message?: unknown } | null;
  const message = typeof e?.message === "string" ? e.message : "";
  const code =
    typeof e?.code === "number" ||
    (typeof e?.code === "string" && /^[a-zA-Z0-9/_-]{1,80}$/.test(e.code))
      ? e.code
      : "unknown";
  const index = /requires? an index|index.*(building|not ready)/i.test(message);
  const kind = index
    ? "index-required-or-building"
    : /credential|default credentials|metadata.*server/i.test(message)
      ? "admin-credentials"
      : code === 7 || code === "permission-denied"
        ? "iam-permission"
        : "backend-error";
  const indexUrl = index
    ? message.match(/https:\/\/console\.firebase\.google\.com\/[^\s<>"']+/)?.[0]
    : undefined;
  return { stage, code, kind, ...(indexUrl ? { indexUrl } : {}) };
}
