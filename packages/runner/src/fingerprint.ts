import { createHash } from "crypto";

/**
 * Compute a stable SHA-256 fingerprint of any value.
 *
 * Rules:
 *  - Objects: keys sorted recursively, so insertion order does not matter.
 *  - Arrays:  order preserved (semantically ordered).
 *  - The "fingerprint" key is excluded at every nesting level so that a plan
 *    or criteria object can be hashed without including its own computed hash.
 *  - Primitives (string, number, boolean, null) serialized as-is.
 *
 * Returns the first 16 hex characters of the SHA-256 digest.
 */
export function computeFingerprint(data: unknown): string {
  const json = stableSerialize(data);
  return createHash("sha256").update(json, "utf8").digest("hex").slice(0, 16);
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableSerialize).join(",") + "]";
  }
  // Plain object: sort keys, skip "fingerprint" key at any depth
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => k !== "fingerprint").sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + stableSerialize(obj[k]));
  return "{" + pairs.join(",") + "}";
}
