import { createSign } from "node:crypto";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * RS256 service-account assertion. No OAuth consent screen is involved: the key is
 * exchanged directly for a short-lived access token at TOKEN_URL.
 */
export function makeAssertion(account: ServiceAccount, nowMs: number = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);

  return `${header}.${claim}.${b64url(signer.sign(account.private_key))}`;
}
