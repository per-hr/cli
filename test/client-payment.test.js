import { test } from "node:test";
import assert from "node:assert/strict";
import { askClientPayment, PAYMENT_HINT } from "../lib/client-payment.js";

test("without a keyboard, perhr never asks for payment details and says where to set them", async () => {
  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  try {
    const r = await askClientPayment({}, { id: "c1", name: "Northline Outfitters" });
    assert.equal(r, null);
  } finally {
    console.log = log;
  }
  assert.ok(lines.some((l) => l.includes("Edit Client")));
});

test("the hint names the client and the command", () => {
  const h = PAYMENT_HINT("Studio Lark");
  assert.ok(h.includes("Studio Lark") && h.includes("--payment"));
});
