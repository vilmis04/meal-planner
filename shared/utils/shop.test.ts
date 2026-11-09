import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHOP_NAME_MAX_LENGTH, findShopByName, getShopChoices, getShopNameKey } from "./shop";
import { shopNameSchema } from "./shop.schema";

const MIGRATION_PATH = "supabase/migrations/20261117000000_create_shops_and_purchases.sql";
// The shop name length check, e.g. "check (char_length(name) between 1 and 60)".
const SHOP_NAME_LENGTH_CHECK_REGEX = /shops_name_length check \(char_length\(name\) between 1 and (\d+)\)/;

const lidl = { id: "00000000-0000-4000-8000-0000000000a1", name: "Lidl" };
const maxima = { id: "00000000-0000-4000-8000-0000000000a2", name: "Maxima" };
const azuolas = { id: "00000000-0000-4000-8000-0000000000a3", name: "Ąžuolas" };

describe("getShopNameKey", () => {
  it("tidies white space and ignores case, as name_key does", () => {
    expect(getShopNameKey("  LIDL   Žirmūnai ")).toBe("lidl žirmūnai");
  });
});

describe("findShopByName", () => {
  it("finds a known shop however it is typed", () => {
    expect(findShopByName([lidl, maxima], " lidl ")).toEqual(lidl);
    expect(findShopByName([lidl, maxima], "Rimi")).toBeNull();
  });
});

describe("getShopChoices", () => {
  it("lists one shop per name in alphabetical order for the locale", () => {
    const ownLidl = { id: "00000000-0000-4000-8000-0000000000a4", name: "LIDL" };

    expect(getShopChoices([maxima, lidl, ownLidl, azuolas], "lt")).toEqual([azuolas, lidl, maxima]);
  });
});

describe("shopNameSchema", () => {
  it("tidies a name and takes 1 to 60 characters", () => {
    expect(shopNameSchema.parse("  Rimi \t Ozas ")).toBe("Rimi Ozas");
    expect(shopNameSchema.safeParse("   ").success).toBe(false);
    expect(shopNameSchema.safeParse("x".repeat(SHOP_NAME_MAX_LENGTH)).success).toBe(true);
    expect(shopNameSchema.safeParse("x".repeat(SHOP_NAME_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("allows the length the database allows", () => {
    const migration = readFileSync(MIGRATION_PATH, "utf8");

    expect(Number(SHOP_NAME_LENGTH_CHECK_REGEX.exec(migration)?.[1])).toBe(SHOP_NAME_MAX_LENGTH);
  });
});
