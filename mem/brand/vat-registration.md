---
name: OCCTA VAT registration
description: OCCTA is VAT registered from 01 July 2026. VAT No. 520 6072 30, standard rate 20%.
type: feature
---
OCCTA LIMITED is VAT registered from **01 July 2026**.

- VAT number: **520 6072 30** (also stored on `platform_settings.vat_number` and `companyConfig.vatNumber`).
- Default VAT rate: **20%** (`platform_settings.vat_default_rate`, `companyConfig.defaultVatRate`).
- Scheme: Standard VAT accounting.
- Residential prices: **inc VAT** first (`platform_settings.residential_vat_display = 'inclusive'`).
- Business prices: **ex VAT + inc VAT** (`platform_settings.business_vat_display = 'dual'`).

Rules:
- Any invoice/receipt issued on or after 01 July 2026 must display the VAT number and a net / VAT / gross breakdown.
- Historical invoices dated before 01 July 2026 must **not** be modified. `isVatApplicableFor(dateIso)` gates VAT-number rendering on client PDF regenerators (`generateInvoicePdf`, `generatePaymentReceiptPdf`) using the document's issue/paid date.
- Do not edit signed Contract Summary PDFs / hashes already accepted before 01 July 2026.
- Ira must reply to "how do I reclaim VAT" with: *"Business customers should speak to their accountant or tax adviser about reclaiming VAT."* Ira never gives tax advice.