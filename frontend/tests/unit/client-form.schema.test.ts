import { describe, expect, it } from "vitest";
import {
  clientFormSchema,
  clientToFormValues,
  diffDraft,
  hasChanges,
  PHONE_PATTERN,
} from "@/modules/clients/schemas/client-form.schema";
import type { Client } from "@/modules/clients/types";

const base: Client = {
  id: 1,
  name: "Acme Corp",
  email: "contact@acme.example.com",
  phone: "+1 415 555 0101",
  companyName: "Acme Corporation",
  address: "1 Market St",
  notes: "Flagship",
  isActive: true,
  createdAt: "2026-02-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
};

function values(over: Partial<ReturnType<typeof clientToFormValues>> = {}) {
  return { ...clientToFormValues(base), ...over };
}

describe("clientFormSchema validation", () => {
  it("accepts a valid full form", () => {
    expect(clientFormSchema.safeParse(values()).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const r = clientFormSchema.safeParse(values({ name: "" }));
    expect(r.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const r = clientFormSchema.safeParse(values({ email: "not-an-email" }));
    expect(r.success).toBe(false);
  });

  it("accepts an international phone and rejects one without a +country code", () => {
    expect(PHONE_PATTERN.test("+1 415 555 0101")).toBe(true);
    expect(PHONE_PATTERN.test("+442079460102")).toBe(true);
    expect(PHONE_PATTERN.test("4155550101")).toBe(false);
    expect(PHONE_PATTERN.test("555-0101")).toBe(false);
    expect(clientFormSchema.safeParse(values({ phone: "4155550101" })).success).toBe(false);
  });

  it("allows empty optionals", () => {
    expect(
      clientFormSchema.safeParse(values({ companyName: "", address: "", notes: "" })).success
    ).toBe(true);
  });
});

describe("diffDraft / hasChanges", () => {
  it("emits only changed fields", () => {
    const draft = diffDraft(base, values({ companyName: "Acme Holdings" }));
    expect(draft).toEqual({ companyName: "Acme Holdings" });
    expect(hasChanges(draft)).toBe(true);
  });

  it("emits null when clearing a previously-set optional", () => {
    const draft = diffDraft(base, values({ address: "" }));
    expect(draft).toEqual({ address: null });
  });

  it("returns an empty draft when nothing changed", () => {
    const draft = diffDraft(base, values());
    expect(hasChanges(draft)).toBe(false);
    expect(draft).toEqual({});
  });

  it("trims before comparing so whitespace-only edits are no-ops", () => {
    const draft = diffDraft(base, values({ name: "  Acme Corp  " }));
    expect(hasChanges(draft)).toBe(false);
  });
});

describe("clientToFormValues", () => {
  it("maps nulls to empty strings", () => {
    const v = clientToFormValues({ ...base, companyName: null, address: null, notes: null });
    expect(v.companyName).toBe("");
    expect(v.address).toBe("");
    expect(v.notes).toBe("");
  });
});
