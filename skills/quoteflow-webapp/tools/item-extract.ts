import { readFile } from "node:fs/promises";

export interface ItemExtractInput {
  email_body_content?: string;
  from_email?: string;
  from_name?: string;
  cc?: string | string[];
  attachment_text?: string;
  user_full_name?: string;
}

export interface ExtractedItem {
  item_id: number;
  company_description: string;
  qty: number;
  uom: string;
}

export interface CustomerPartial {
  email: string;
  attention_person: string;
  carbon_copy_person: string[];
  phone: string;
  fax_number: string;
}

export interface ItemExtractResult {
  success: boolean;
  items: ExtractedItem[];
  rfq_items: Array<{ item_id: number; company_requirement: Omit<ExtractedItem, "item_id"> }>;
  customer_partial: CustomerPartial;
  error?: string;
}

function customerPartial(input: ItemExtractInput): CustomerPartial {
  const body = input.email_body_content ?? "";
  const attachment = input.attachment_text ?? "";
  const searchText = attachment ? `${attachment}\n${body}` : body;
  const removeNamePrefix = (name: string) => name.replace(/^(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/i, "").trim();
  const candidates: string[] = [];
  for (const source of [attachment, body]) for (const match of source.matchAll(/Attn[:\s]+\n*([A-Z][^\n,;]{2,})/gi)) {
    const name = removeNamePrefix(match[1]).replace(/,\s*.*$/, "").trim();
    if (name.length >= 3) candidates.push(name);
  }
  const signature = body.match(/(?:Sincerely|Thank\s+you|Regards|Best)[,\s]*\n+(?:\d{4}[\-/]\d{2}[\-/]\d{2}\n+(?:\d{2}:\d{2}:\d{2}\n+)?)?(?:_+\n+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
  if (signature) candidates.push(signature[1].trim());
  const userName = (input.user_full_name ?? "").trim().toLowerCase();
  const attentionPerson = candidates.find((candidate) => candidate.trim().toLowerCase() !== userName) ?? "";
  const carbonCopyPerson: string[] = [];
  const ccMatch = attachment.match(/C\.?c\s*:\s*([^\n]*?)(?=\s{2,}(?:Page|Subject|Dear|Enclosed|Re:|To:|From:|Attn:|Phone)\b|\n\s*(?:Page|Subject|Dear|Enclosed|Re:|To:|From:|Attn:|Phone)\b|\n\n|$)/i);
  if (ccMatch) for (const segment of ccMatch[1].split(/(?=\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z])/)) {
    const name = removeNamePrefix(segment).split(",")[0].trim();
    if (name.length >= 3) carbonCopyPerson.push(name);
  }
  if (!carbonCopyPerson.length) carbonCopyPerson.push(...(Array.isArray(input.cc) ? input.cc : input.cc ? [input.cc] : []).filter(Boolean));
  const phone = searchText.match(/(?:T|Tel|Phone|Telephone|HP)[\s:]+([+\d \t\-().]+\d)/i)?.[1]?.trim() ?? "";
  const fax = searchText.match(/(?:Fax|F)[\s:]+([+\d \t\-().]+\d)/i)?.[1]?.trim() ?? "";
  return { email: input.from_email ?? "", attention_person: attentionPerson, carbon_copy_person: carbonCopyPerson, phone, fax_number: fax };
}

function item(item_id: number, company_description: string, qty: number, uom: string): ExtractedItem {
  return { item_id, company_description: company_description.trim(), qty, uom: uom ? uom.toUpperCase() : "EA" };
}

function pipeDelimitedItems(text: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];
  for (const row of text.match(/^\d+\s*\|.+$/gm) ?? []) {
    const cells = row.split("|").map((cell) => cell.trim());
    if (cells.length < 3 || !/^\d+$/.test(cells[0])) continue;
    let descriptionCells = cells.slice(1, -1);
    if (descriptionCells.length > 1 && /^\d{5,7}$/.test(descriptionCells[0])) descriptionCells = descriptionCells.slice(1);
    const lastCell = cells.at(-1) ?? "";
    items.push(item(Number(cells[0]), descriptionCells.join(" | "), Number(lastCell.match(/(\d+)/)?.[1] ?? 1), lastCell.match(/\(([A-Z]+)\)/i)?.[1] ?? "EA"));
  }
  return items;
}

function tableStateMachine(text: string): ExtractedItem[] {
  const start = text.match(/(?:1\.\s*)?(?:Scope\s+of\s+Requirement|Description\s+of\s+Goods\/Services)/i);
  if (!start || start.index === undefined) return [];
  const afterStart = text.slice(start.index);
  const end = afterStart.match(/(?:\d+\.\s*(?:Price\s+Terms|Payment|Delivery|Warranty|Special)|^\s*\*+\s*$|(?:Thank\s+you|Sincerely|Best\s+regards|Kind\s+regards))/im);
  const tableSlice = end?.index === undefined ? afterStart : afterStart.slice(0, end.index);
  const uom = tableSlice.match(/QTY\s*\(([A-Z]+)\)/i)?.[1] ?? "EA";
  const tokens = tableSlice.replace(/[\*_]+/g, "").replace(/  +/g, "\n").split(/\s+/).filter(Boolean);
  const items: ExtractedItem[] = [];
  let state: "EXPECT_ITEM_NUM" | "EXPECT_MAXIMO_OR_DESC" | "COLLECT_DESC" = "EXPECT_ITEM_NUM";
  let lastEmittedItemId = 0, currentItemNum = 0, description: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (state === "EXPECT_ITEM_NUM") {
      if (/^\d{1,2}$/.test(token) && Number(token) === lastEmittedItemId + 1) { currentItemNum = Number(token); description = []; state = "EXPECT_MAXIMO_OR_DESC"; }
      continue;
    }
    if (state === "EXPECT_MAXIMO_OR_DESC") { state = "COLLECT_DESC"; if (!/^\d{5,7}$/.test(token)) description.push(token); continue; }
    if (/^\d{1,4}$/.test(token) && (tokens[index + 1] === undefined || tokens[index + 1] === String(lastEmittedItemId + 2))) {
      items.push(item(currentItemNum, description.join(" "), Number(token), uom)); lastEmittedItemId = currentItemNum; state = "EXPECT_ITEM_NUM"; continue;
    }
    description.push(token);
  }
  return items;
}

function fieldValue(text: string, label: string): string { return text.match(new RegExp(`^\\s*${label}\\s*:\\s*(.+?)\\s*$`, "im"))?.[1]?.trim() ?? ""; }

function keyValueItem(text: string): ExtractedItem[] {
  const description = fieldValue(text, "Description");
  if (!description) return [];
  const fields: Array<[string, string]> = [["Manufacturer / Package supplier", fieldValue(text, "Manufacturer(?:\\s*/\\s*Package supplier)?")], ["Model", fieldValue(text, "(?:Heat exchanger model|Model)")], ["Tag", fieldValue(text, "(?:Equipment tag|Tag)")], ["Service", fieldValue(text, "Service")], ["Number of plates", fieldValue(text, "Number of plates")], ["Material", fieldValue(text, "(?:Gasket material|Material)")], ["Design pressure", fieldValue(text, "Design pressure")], ["Test pressure", fieldValue(text, "Test pressure")], ["Design temperature", fieldValue(text, "Design temperature")], ["Heat transfer area", fieldValue(text, "Heat transfer area")]];
  const qtyMatch = text.match(/^\s*(?:Required\s+)?(?:gasket\s+)?(?:quantity|qty)\s*:\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?/im);
  return [item(1, [description, ...fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`)].join("; "), qtyMatch ? Math.ceil(Number(qtyMatch[1])) : 1, qtyMatch?.[2] ?? "EA")];
}

export function extractRfqItems(text: string): ExtractedItem[] {
  const pipe = pipeDelimitedItems(text); if (pipe.length) return pipe;
  const table = tableStateMachine(text); return table.length ? table : keyValueItem(text);
}

export function extractItems(input: ItemExtractInput): ItemExtractResult {
  const partial = customerPartial(input), text = input.email_body_content ?? "";
  if (!text.trim()) return { success: false, items: [], rfq_items: [], customer_partial: partial, error: "email_body_content is required" };
  const items = extractRfqItems(text);
  return { success: true, items, rfq_items: items.map(({ item_id, company_description, qty, uom }) => ({ item_id, company_requirement: { company_description, qty, uom } })), customer_partial: partial };
}

async function main(): Promise<void> {
  try {
    const source = process.argv[2] ? await readFile(process.argv[2], "utf8") : await new Promise<string>((resolve, reject) => { let data = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { data += chunk; }); process.stdin.on("end", () => resolve(data)); process.stdin.on("error", reject); });
    const result = extractItems(source.trim() ? JSON.parse(source) : {}); process.stdout.write(`${JSON.stringify(result)}\n`); if (!result.success) process.exitCode = 1;
  } catch (error) { const message = error instanceof Error ? error.message : String(error); process.stdout.write(`${JSON.stringify({ success: false, items: [], rfq_items: [], customer_partial: customerPartial({}), error: message })}\n`); process.exitCode = 1; }
}

if (process.argv[1] && new URL(import.meta.url).pathname === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).pathname) void main();
