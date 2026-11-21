/** Server-only usage: dynamically import from authenticated server handlers. */
function requireApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("RCM Buddy mailbox activation is pending.");
  return key;
}

export async function authorizeAppUserOAuth(params: {
  gatewayBaseUrl: string; connectorId: string; appUserId: string;
  clientAPIKey: string; returnUrl: string; credentialsConfiguration?: Record<string, unknown>;
}) {
  const response = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json", "X-Client-Api-Key": params.clientAPIKey },
    body: JSON.stringify({ connector_id: params.connectorId, app_user_id: params.appUserId, return_url: params.returnUrl, credentials_configuration: params.credentialsConfiguration }),
  });
  const body = await checkedJson(response, "Mailbox authorisation");
  if (typeof body["authorization_url"] !== "string") throw new Error("The email provider did not return an authorisation link.");
  return { authorizationUrl: body["authorization_url"], sessionId: typeof body["session_id"] === "string" ? body["session_id"] : "" };
}

export async function exchangeAppUserOAuthCode(gatewayBaseUrl: string, code: string) {
  const response = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, {
    method: "POST", headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
  const body = await checkedJson(response, "Mailbox connection");
  if (typeof body["api_key"] !== "string" || typeof body["connector_id"] !== "string") throw new Error("The mailbox connection did not issue a usable credential.");
  return { connectionAPIKey: body["api_key"], connectorId: body["connector_id"] };
}

export async function callAsAppUser(params: {
  gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string;
  path: string; init?: RequestInit; requiredScopes?: string[];
}) {
  const headers = new Headers(params.init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", params.connectionAPIKey);
  if (params.requiredScopes?.length) headers.set("X-Lovable-Required-Scopes", params.requiredScopes.join(" "));
  return fetch(`${params.gatewayBaseUrl}/${params.connectorId}${params.path.startsWith("/") ? params.path : `/${params.path}`}`, { ...params.init, headers });
}

export async function appUserReconnectRequired(response: Response) {
  if (response.status !== 401) return false;
  const body: unknown = await response.clone().json().catch(() => null);
  return !!body && typeof body === "object" && "type" in body && typeof body.type === "string" && body.type.startsWith("credential_");
}

export async function disconnectAppUser(params: { gatewayBaseUrl: string; connectionAPIKey: string; connectorId: string }) {
  const response = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/connection`, {
    method: "DELETE", headers: { Authorization: `Bearer ${requireApiKey()}`, "X-Connection-Api-Key": params.connectionAPIKey, "Content-Type": "application/json" },
    body: JSON.stringify({ connector_id: params.connectorId }),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Mailbox disconnect failed [${response.status}]: ${text}`);
    throw new Error(`Mailbox disconnect failed [${response.status}]: ${text}`);
  }
}

async function checkedJson(response: Response, action: string): Promise<Record<string, unknown>> {
  if (!response.ok) {
    const text = await response.text();
    console.error(`${action} failed [${response.status}]: ${text}`);
    throw new Error(`${action} failed [${response.status}]: ${text}`);
  }
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${action} returned an invalid response.`);
  return value as Record<string, unknown>;
}