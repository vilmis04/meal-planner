import { describe, expect, it } from "vitest";
import { isCronRequestAuthorized } from "./cronSecret";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("isCronRequestAuthorized", () => {
  it("accepts the secret as a bearer token", () => {
    expect(isCronRequestAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuses a missing header, another scheme or a wrong secret", () => {
    expect(isCronRequestAuthorized(undefined, SECRET)).toBe(false);
    expect(isCronRequestAuthorized(SECRET, SECRET)).toBe(false);
    expect(isCronRequestAuthorized(`Basic ${SECRET}`, SECRET)).toBe(false);
    expect(isCronRequestAuthorized(`Bearer ${SECRET.slice(0, -1)}x`, SECRET)).toBe(false);
  });

  it("refuses a prefix or an extension of the secret", () => {
    expect(isCronRequestAuthorized(`Bearer ${SECRET.slice(0, 10)}`, SECRET)).toBe(false);
    expect(isCronRequestAuthorized(`Bearer ${SECRET}0`, SECRET)).toBe(false);
    expect(isCronRequestAuthorized("Bearer ", SECRET)).toBe(false);
  });
});
