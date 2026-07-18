import type { DocumentData } from "@/types/documents";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPrintHtml(document: DocumentData): string {
  const title =
    document.type === "rfq_analysis" ? document.subject :
    document.type === "supplier_search" ? document.title :
    document.title;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; color: #111827; margin: 32px; }
    h1 { font-size: 22px; color: #0f766e; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #1f2937; padding: 8px; font-size: 12px; vertical-align: top; }
    th { background: #f3f4f6; }
    pre { white-space: pre-wrap; font-family: inherit; }
    @media print { body { margin: 18mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <pre>${escapeHtml(JSON.stringify(document, null, 2))}</pre>
</body>
</html>`;
}
