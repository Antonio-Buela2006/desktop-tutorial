import { describe, expect, it } from "vitest";
import { canonicalJson } from "./audit.js";

describe("auditoria", () => {
  it("JSON canónico é independente da ordem das chaves", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { y: 2, z: 1 }] }, b: 1 }));
  });
});
