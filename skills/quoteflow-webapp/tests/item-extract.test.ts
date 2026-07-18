import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractItems, type ItemExtractInput, type ItemExtractResult } from "../tools/item-extract.ts";

interface Fixture { name: string; input: ItemExtractInput; expected: ItemExtractResult; }
const fixtures = JSON.parse(await readFile(new URL("./fixtures/item-extract-parity.json", import.meta.url), "utf8")) as Fixture[];
for (const fixture of fixtures) test(`matches PowerShell parity fixture: ${fixture.name}`, () => assert.deepEqual(extractItems(fixture.input), fixture.expected));
test("reports missing email body with the legacy failure contract", () => assert.deepEqual(extractItems({ from_email: "buyer@example.com" }), { success: false, items: [], rfq_items: [], customer_partial: { email: "buyer@example.com", attention_person: "", carbon_copy_person: [], phone: "", fax_number: "" }, error: "email_body_content is required" }));
