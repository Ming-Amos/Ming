export type ApiError = Error & { existingTaskId?: string; status?: number };

/** Same-origin application requests. Secrets are never persisted by this client. */
export async function api<T>(
  url: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch(
    url,
    body === undefined && !method
      ? undefined
      : {
          method: method || "POST",
          headers:
            body === undefined
              ? undefined
              : { "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
  );
  let data: { ok?: boolean; error?: string; existingTaskId?: string };
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `The service is unavailable (${response.status}). Check that Ming is running.`,
    );
  }
  if (!response.ok || data.ok === false) {
    const error = new Error(
      data.error || `Request failed (${response.status})`,
    ) as ApiError;
    error.existingTaskId = data.existingTaskId;
    error.status = response.status;
    throw error;
  }
  return data as T;
}

export function downloadText(
  filename: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
