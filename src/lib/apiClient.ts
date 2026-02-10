function getServerInfo() {
  if (typeof window !== "undefined") return null;
  // Lazy import to keep this module safe for client usage.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { headers, cookies } = require("next/headers");
  const headersList = headers();
  const cookieStore = cookies();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return {
    baseUrl: host ? `${protocol}://${host}` : "http://localhost:3000",
    cookieHeader: cookieStore
      .getAll()
      .map((cookie: { name: string; value: string }) => `${cookie.name}=${cookie.value}`)
      .join("; "),
  };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const serverInfo = getServerInfo();
  const baseUrl = serverInfo?.baseUrl ?? "";
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(serverInfo?.cookieHeader ? { cookie: serverInfo.cookieHeader } : {}),
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
