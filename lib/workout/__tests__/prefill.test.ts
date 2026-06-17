import { describe, expect, it } from "vitest";
import { pickPrefillValue } from "../prefill";

describe("pickPrefillValue", () => {
  it("prefers existing logged value first", () => {
    expect(pickPrefillValue(200, 185, 2)).toBe(200);
  });

  it("prefers previous value over template placeholder", () => {
    expect(pickPrefillValue(null, 195, 2)).toBe(195);
  });

  it("falls back to template when no existing or previous value", () => {
    expect(pickPrefillValue(undefined, undefined, 2)).toBe(2);
  });
});
