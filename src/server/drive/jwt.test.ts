import { describe, expect, it } from "vitest";

import { b64url, DRIVE_SCOPE, makeAssertion, TOKEN_URL } from "./jwt";
import { generateKeyPairSync, createVerify } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const account = {
  client_email: "gallery@example.iam.gserviceaccount.com",
  private_key: privateKey,
};

describe("b64url", () => {
  it("has no padding or unsafe characters", () => {
    expect(b64url("a?b~c")).toBe("YT9ifmM");
    expect(b64url(Buffer.from([0xfb, 0xff]))).toBe("-_8");
  });
});

describe("makeAssertion", () => {
  const assertion = makeAssertion(account, 1_700_000_000_000);
  const [header, claim, signature] = assertion.split(".");

  it("is a three-part RS256 JWT", () => {
    expect(assertion.split(".")).toHaveLength(3);
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
  });

  it("carries the Drive scope, issuer, audience, and a one-hour lifetime", () => {
    const decoded = JSON.parse(Buffer.from(claim, "base64url").toString());
    expect(decoded.iss).toBe(account.client_email);
    expect(decoded.scope).toBe(DRIVE_SCOPE);
    expect(decoded.aud).toBe(TOKEN_URL);
    expect(decoded.iat).toBe(1_700_000_000);
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it("verifies against the matching public key", () => {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${claim}`);
    expect(verifier.verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });
});
