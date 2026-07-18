# QuoteFlow Reusable Web App

Local procurement UI for signup, RFQ reports, supplier reports, stage review previews, pricing, and editable technical/commercial proposals.

## Setup

```powershell
cd C:\Users\LENOVO\.codex\skills\quoteflow-webapp
$env:DATABASE_URL = '<your Neon database URL>'
npm install
npm run dev
```

Open the local URL shown by Next.js, usually `http://localhost:3000`.

Keep real database URLs in environment variables. Do not commit `.env` files.

Reusable skill-owned copy:

```text
C:\Users\LENOVO\.codex\skills\quoteflow-webapp
```

The app provides:

- Signup that writes `SIGNUP.json` and legacy `SIGNUP.txt`.
- RFQ, supplier-search, supplier quote normalization, technical compliance, and certificate/origin previews from Neon.
- A two-tier pricing panel: typing changes local draft values only; Apply calculates and persists official pricing into `quotations` and `quotation_pricing`.
- A Proposal section with editable Technical and Commercial proposal views based on the QuoteFlow proposal HTML format.
- Empty unavailable views show `Data not available yet`.
