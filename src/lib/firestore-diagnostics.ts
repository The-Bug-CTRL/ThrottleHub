/** Keep provider diagnostics (including index URLs) in server logs, never in UI. */
export async function firestoreQuery<T>(
  context: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const details = error as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    } | null;
    console.error(`[Firestore] ${context}`, {
      code: details?.code,
      message: details?.message,
      details: details?.details,
    });
    throw error;
  }
}
