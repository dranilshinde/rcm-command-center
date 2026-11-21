// Uses Web Crypto so encryption works in both the preview and published server.
export async function encryptConnectionKey(plaintext: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const stored = new Uint8Array(iv.length + encrypted.length);
  stored.set(iv); stored.set(encrypted, iv.length);
  return btoa(Array.from(stored, (b) => String.fromCharCode(b)).join(""));
}

export async function decryptConnectionKey(stored: string, secret: string): Promise<string> {
  const bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  if (bytes.length < 29) throw new Error("The mailbox credential could not be read. Reconnect your mailbox.");
  const key = await importKey(secret);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(decrypted);
}

async function importKey(secret: string) {
  const bytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error("Mailbox encryption is not configured correctly.");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function hashMailboxNonce(nonce: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}