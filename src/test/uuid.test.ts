import { afterEach, describe, expect, it, vi } from "vitest";
import { generateUuid } from "@/lib/uuid";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateUuid", () => {
  it("uses crypto.randomUUID when available", () => {
    const randomUUID = vi.fn(() => "trusted-uuid");
    vi.stubGlobal("crypto", { randomUUID });

    expect(generateUuid()).toBe("trusted-uuid");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("generates an RFC 4122 version 4 UUID with getRandomValues", () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.forEach((_, index) => {
        bytes[index] = index;
      });
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues });

    expect(generateUuid()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("fails explicitly when secure randomness is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => generateUuid()).toThrow(
      "Secure random UUID generation is not supported by this browser.",
    );
  });
});
