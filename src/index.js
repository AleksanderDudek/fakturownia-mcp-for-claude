#!/usr/bin/env node
/**
 * Serwer MCP dla API Fakturowni — wersja Node.js.
 *
 * Przepisany z Pythona na Node, żeby bundle .mcpb działał u każdego bez
 * instalowania Pythona i bez problemów ze skompilowanymi binariami
 * (Claude Desktop dostarcza własny Node.js).
 *
 * Zmienne środowiskowe:
 *   FAKTUROWNIA_DOMAIN     np. "mojafirma" albo pełny host
 *   FAKTUROWNIA_API_TOKEN  Kod autoryzacyjny API
 *   FAKTUROWNIA_EXPORT_DIR opcjonalnie: katalog na eksporty
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Konfiguracja
// ---------------------------------------------------------------------------

function baseUrl() {
  let domain = (process.env.FAKTUROWNIA_DOMAIN || "").trim();
  if (!domain) {
    console.error("BŁĄD: brak zmiennej FAKTUROWNIA_DOMAIN.");
    process.exit(1);
  }
  if (!domain.endsWith(".fakturownia.pl")) domain = `${domain}.fakturownia.pl`;
  return `https://${domain}`;
}

function apiToken() {
  const t = (process.env.FAKTUROWNIA_API_TOKEN || "").trim();
  if (!t) {
    console.error("BŁĄD: brak zmiennej FAKTUROWNIA_API_TOKEN.");
    process.exit(1);
  }
  return t;
}

const BASE_URL = baseUrl();
const API_TOKEN = apiToken();
const EXPORT_DIR = process.env.FAKTUROWNIA_EXPORT_DIR || "eksporty";
const PER_PAGE = 100;

// ---------------------------------------------------------------------------
// Warstwa HTTP
// ---------------------------------------------------------------------------

async function apiGet(pathname, params = {}) {
  const url = new URL(`${BASE_URL}${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_token", API_TOKEN);
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(
      `Odmowa dostępu (HTTP ${resp.status}). Sprawdź token i domenę.`
    );
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status} przy ${pathname}`);
  return resp.json();
}

async function getAllPages(pathname, params = {}, maxPages = 100) {
  const out = [];
  let page = 1;
  while (page <= maxPages) {
    const data = await apiGet(pathname, { ...params, per_page: PER_PAGE, page });
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    if (data.length < PER_PAGE) break;
    page += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pomocnicze: liczby, daty, formatowanie
// ---------------------------------------------------------------------------

function num(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  let s = String(v).trim().replace(/\s|\u00a0/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", "."); // 1.234,56 -> 1234.56
  } else {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseDate(v) {
  if (!v) return null;
  const m = String(v).slice(0, 10);
  const d = new Date(m + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

function outstanding(inv) {
  return round2(num(inv.price_gross) - num(inv.paid));
}

function isPaid(inv) {
  return inv.status === "paid" || outstanding(inv) <= 0.005;
}

function shortInvoice(inv) {
  return {
    id: inv.id,
    number: inv.number,
    kind: inv.kind,
    issue_date: inv.issue_date,
    payment_to: inv.payment_to,
    buyer_name: inv.buyer_name,
    buyer_tax_no: inv.buyer_tax_no,
    price_net: num(inv.price_net),
    price_gross: num(inv.price_gross),
    paid: num(inv.paid),
    outstanding: outstanding(inv),
    currency: inv.currency,
    status: inv.status,
  };
}

function periodParams(period, dateFrom, dateTo) {
  const p = { period };
  if (period === "more") {
    if (!dateFrom || !dateTo) {
      throw new Error('Dla period="more" podaj date_from i date_to (RRRR-MM-DD).');
    }
    p.date_from = dateFrom;
    p.date_to = dateTo;
  }
  return p;
}

const SKIP_KINDS_REVENUE = new Set(["proforma", "estimate"]);
const SKIP_KINDS_RECEIVABLE = new Set(["proforma", "estimate", "kp", "kw"]);

function ok(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

// ---------------------------------------------------------------------------
// Serwer + narzędzia
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "fakturownia", version: "1.0.0" });

const periodEnum = z
  .enum([
    "all", "this_month", "last_month", "last_30_days",
    "this_year", "last_year", "last_12_months", "more",
  ])
  .default("this_month");

// --- lista faktur ---
server.registerTool(
  "list_invoices",
  {
    description:
      "Lista faktur z okresu (skrócone pola), posortowana, z szybkim podsumowaniem.",
    inputSchema: {
      period: periodEnum,
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      kind: z.string().optional(),
      income: z.enum(["yes", "no"]).default("yes"),
      order: z.string().default("issue_date.desc"),
      limit: z.number().int().default(50),
    },
  },
  async ({ period, date_from, date_to, kind, income, order, limit }) => {
    const params = periodParams(period, date_from, date_to);
    params.order = order;
    if (income === "no") params.income = "no";
    if (kind) params.kind = kind;
    let rows = await getAllPages("/invoices.json", params);
    rows = rows.slice(0, limit);
    const short = rows.map(shortInvoice);
    return ok({
      period,
      count: short.length,
      sum_gross: round2(short.reduce((a, i) => a + i.price_gross, 0)),
      invoices: short,
    });
  }
);

// --- znajdź fakturę ---
server.registerTool(
  "find_invoice",
  {
    description: "Znajdź fakturę po numerze lub ID (pełne dane z pozycjami).",
    inputSchema: {
      number: z.string().optional(),
      invoice_id: z.number().int().optional(),
    },
  },
  async ({ number, invoice_id }) => {
    if (invoice_id !== undefined) {
      return ok(await apiGet(`/invoices/${invoice_id}.json`));
    }
    if (number) {
      const rows = await apiGet("/invoices.json", { number });
      if (Array.isArray(rows) && rows.length) {
        return ok(await apiGet(`/invoices/${rows[0].id}.json`));
      }
      return ok({ found: false, note: `Nie znaleziono faktury o numerze ${number}.` });
    }
    throw new Error("Podaj number albo invoice_id.");
  }
);

// --- nieopłacone / przeterminowane ---
server.registerTool(
  "unpaid_invoices",
  {
    description:
      "Faktury nieopłacone (lub tylko przeterminowane) z saldami i podziałem wiekowym. " +
      "Przeterminowanie liczone względem dzisiejszej daty.",
    inputSchema: {
      period: periodEnum.removeDefault().default("all"),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      overdue_only: z.boolean().default(false),
    },
  },
  async ({ period, date_from, date_to, overdue_only }) => {
    const rows = await getAllPages("/invoices.json", periodParams(period, date_from, date_to));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const buckets = { "0-7": 0, "8-30": 0, "31-60": 0, "60+": 0 };
    const items = [];
    let totalOut = 0;

    for (const r of rows) {
      if (SKIP_KINDS_RECEIVABLE.has(r.kind)) continue;
      if (isPaid(r)) continue;
      const due = parseDate(r.payment_to);
      const days = due ? Math.floor((today - due) / 86400000) : null;
      const overdue = days !== null && days > 0;
      if (overdue_only && !overdue) continue;
      const out = outstanding(r);
      totalOut += out;
      if (overdue) {
        const b = days <= 7 ? "0-7" : days <= 30 ? "8-30" : days <= 60 ? "31-60" : "60+";
        buckets[b] += out;
      }
      const s = shortInvoice(r);
      s.days_overdue = overdue ? days : 0;
      items.push(s);
    }
    items.sort((a, b) => b.days_overdue - a.days_overdue);
    for (const k of Object.keys(buckets)) buckets[k] = round2(buckets[k]);
    return ok({
      period,
      today: today.toISOString().slice(0, 10),
      count: items.length,
      total_outstanding: round2(totalOut),
      aging_overdue: buckets,
      invoices: items,
    });
  }
);

// --- podsumowanie obrotu ---
async function revenueSummary(period, dateFrom, dateTo, income) {
  const params = periodParams(period, dateFrom, dateTo);
  if (income === "no") params.income = "no";
  let rows = await getAllPages("/invoices.json", params);
  rows = rows.filter((r) => !SKIP_KINDS_REVENUE.has(r.kind));
  const net = rows.reduce((a, r) => a + num(r.price_net), 0);
  const gross = rows.reduce((a, r) => a + num(r.price_gross), 0);
  const paid = rows.reduce((a, r) => a + num(r.paid), 0);
  const byCcy = {};
  for (const r of rows) {
    const c = r.currency || "PLN";
    byCcy[c] = (byCcy[c] || 0) + num(r.price_gross);
  }
  for (const k of Object.keys(byCcy)) byCcy[k] = round2(byCcy[k]);
  return {
    period,
    income,
    invoice_count: rows.length,
    sum_net: round2(net),
    sum_vat: round2(gross - net),
    sum_gross: round2(gross),
    sum_paid: round2(paid),
    sum_outstanding: round2(gross - paid),
    by_currency_gross: byCcy,
  };
}

server.registerTool(
  "revenue_summary",
  {
    description: "Obrót za okres: netto, VAT, brutto, zapłacone, do zapłaty.",
    inputSchema: {
      period: periodEnum,
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      income: z.enum(["yes", "no"]).default("yes"),
    },
  },
  async ({ period, date_from, date_to, income }) =>
    ok(await revenueSummary(period, date_from, date_to, income))
);

// --- rozbicie VAT ---
server.registerTool(
  "vat_breakdown",
  {
    description: "Rozbicie sprzedaży/kosztów po stawkach VAT (pod JPK).",
    inputSchema: {
      period: periodEnum,
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      income: z.enum(["yes", "no"]).default("yes"),
    },
  },
  async ({ period, date_from, date_to, income }) => {
    const params = periodParams(period, date_from, date_to);
    params.include_positions = "true";
    if (income === "no") params.income = "no";
    const rows = await getAllPages("/invoices.json", params);
    const rates = {};
    for (const r of rows) {
      if (SKIP_KINDS_REVENUE.has(r.kind)) continue;
      for (const p of r.positions || []) {
        const rate = String(p.tax ?? "brak");
        const net = num(p.total_price_net);
        const gross = num(p.total_price_gross);
        if (!rates[rate]) rates[rate] = { net: 0, vat: 0, gross: 0 };
        rates[rate].net += net;
        rates[rate].gross += gross;
        rates[rate].vat += gross - net;
      }
    }
    const byRate = {};
    for (const k of Object.keys(rates).sort()) {
      byRate[k] = {
        net: round2(rates[k].net),
        vat: round2(rates[k].vat),
        gross: round2(rates[k].gross),
      };
    }
    return ok({ period, income, by_rate: byRate });
  }
);

// --- porównanie okresów ---
server.registerTool(
  "compare_periods",
  {
    description: "Porównaj obrót między dwoma okresami (np. this_month vs last_month).",
    inputSchema: {
      period_a: z.string(),
      period_b: z.string(),
      income: z.enum(["yes", "no"]).default("yes"),
    },
  },
  async ({ period_a, period_b, income }) => {
    const a = await revenueSummary(period_a, null, null, income);
    const b = await revenueSummary(period_b, null, null, income);
    const diff = a.sum_gross - b.sum_gross;
    const pct = b.sum_gross ? round2((diff / b.sum_gross) * 100) : null;
    return ok({
      period_a: { [period_a]: a.sum_gross },
      period_b: { [period_b]: b.sum_gross },
      diff_gross: round2(diff),
      diff_pct: pct,
      detail_a: a,
      detail_b: b,
    });
  }
);

// --- ranking klientów ---
server.registerTool(
  "top_clients",
  {
    description: "Ranking klientów po obrocie brutto w okresie.",
    inputSchema: {
      period: periodEnum.removeDefault().default("this_year"),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      limit: z.number().int().default(10),
    },
  },
  async ({ period, date_from, date_to, limit }) => {
    const rows = await getAllPages("/invoices.json", periodParams(period, date_from, date_to));
    const agg = {};
    for (const r of rows) {
      if (SKIP_KINDS_REVENUE.has(r.kind)) continue;
      const name = r.buyer_name || "(brak nazwy)";
      if (!agg[name]) agg[name] = { gross: 0, outstanding: 0, count: 0, tax_no: null };
      agg[name].gross += num(r.price_gross);
      agg[name].outstanding += outstanding(r);
      agg[name].count += 1;
      agg[name].tax_no = r.buyer_tax_no;
    }
    const ranked = Object.entries(agg)
      .sort((a, b) => b[1].gross - a[1].gross)
      .slice(0, limit);
    return ok({
      period,
      clients: ranked.map(([name, v]) => ({
        buyer_name: name,
        buyer_tax_no: v.tax_no,
        sum_gross: round2(v.gross),
        outstanding: round2(v.outstanding),
        invoice_count: v.count,
      })),
    });
  }
);

// --- faktury klienta ---
server.registerTool(
  "client_invoices",
  {
    description: "Wszystkie faktury danego klienta (po nazwie/NIP/ID) i jego saldo.",
    inputSchema: {
      name: z.string().optional(),
      tax_no: z.string().optional(),
      client_id: z.number().int().optional(),
      period: periodEnum.removeDefault().default("all"),
    },
  },
  async ({ name, tax_no, client_id, period }) => {
    let clientName = null;
    if (client_id === undefined) {
      const q = {};
      if (tax_no) q.tax_no = tax_no;
      else if (name) q.name = name;
      else throw new Error("Podaj name, tax_no albo client_id.");
      const found = await apiGet("/clients.json", q);
      if (!Array.isArray(found) || !found.length) {
        return ok({ found: false, note: "Nie znaleziono klienta." });
      }
      client_id = found[0].id;
      clientName = found[0].name;
    }
    const params = periodParams(period, null, null);
    params.client_id = client_id;
    const rows = await getAllPages("/invoices.json", params);
    const short = rows.map(shortInvoice);
    return ok({
      client_id,
      client_name: clientName,
      invoice_count: short.length,
      sum_gross: round2(short.reduce((a, i) => a + i.price_gross, 0)),
      outstanding: round2(short.reduce((a, i) => a + i.outstanding, 0)),
      invoices: short,
    });
  }
);

// --- produkty ---
server.registerTool(
  "list_products",
  {
    description: "Lista produktów/usług z cennika (opcjonalny filtr po nazwie).",
    inputSchema: {
      query: z.string().optional(),
      limit: z.number().int().default(100),
    },
  },
  async ({ query, limit }) => {
    let rows = await getAllPages("/products.json");
    if (query) {
      const ql = query.toLowerCase();
      rows = rows.filter((r) => (r.name || "").toLowerCase().includes(ql));
    }
    rows = rows.slice(0, limit);
    return ok({
      count: rows.length,
      products: rows.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        price_net: num(r.price_net),
        price_gross: num(r.price_gross),
        tax: r.tax,
        stock_level: r.stock_level,
      })),
    });
  }
);

// --- płatności ---
server.registerTool(
  "list_payments",
  {
    description: "Lista płatności (wpłaty/rozliczenia) z okresu.",
    inputSchema: {
      period: periodEnum,
      date_from: z.string().optional(),
      date_to: z.string().optional(),
    },
  },
  async ({ period, date_from, date_to }) => {
    const rows = await getAllPages("/banking/payments.json", periodParams(period, date_from, date_to));
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: num(r.price),
      paid: r.paid,
      kind: r.kind,
      invoice_id: r.invoice_id,
    }));
    return ok({
      period,
      count: items.length,
      sum: round2(items.reduce((a, i) => a + i.price, 0)),
      payments: items,
    });
  }
);

// --- eksport CSV ---
server.registerTool(
  "export_invoices_csv",
  {
    description: "Wyeksportuj faktury z okresu do pliku CSV na dysku.",
    inputSchema: {
      period: periodEnum.removeDefault().default("this_year"),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      filename: z.string().optional(),
    },
  },
  async ({ period, date_from, date_to, filename }) => {
    const rows = await getAllPages("/invoices.json", periodParams(period, date_from, date_to));
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    const fname = filename || `faktury_${period}.csv`;
    const filePath = path.join(EXPORT_DIR, fname);
    const cols = ["id", "number", "kind", "issue_date", "payment_to", "buyer_name",
      "buyer_tax_no", "price_net", "price_gross", "paid", "outstanding",
      "currency", "status"];
    const esc = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.join(",")];
    for (const r of rows) {
      const s = shortInvoice(r);
      lines.push(cols.map((c) => esc(s[c])).join(","));
    }
    fs.writeFileSync(filePath, "\uFEFF" + lines.join("\n"), "utf8"); // BOM dla Excela
    return ok({ path: path.resolve(filePath), rows: rows.length });
  }
);

// --- hurtowe PDF-y ---
server.registerTool(
  "download_invoice_pdfs",
  {
    description: "Pobierz PDF-y faktur na dysk — hurtowo (po okresie) lub konkretne ID.",
    inputSchema: {
      period: periodEnum.removeDefault().optional(),
      date_from: z.string().optional(),
      date_to: z.string().optional(),
      invoice_ids: z.array(z.number().int()).optional(),
      subdir: z.string().default("pdf"),
    },
  },
  async ({ period, date_from, date_to, invoice_ids, subdir }) => {
    let ids = invoice_ids || [];
    if (ids.length === 0) {
      if (!period) throw new Error("Podaj invoice_ids albo period.");
      const rows = await getAllPages("/invoices.json", periodParams(period, date_from, date_to));
      ids = rows.map((r) => r.id).filter(Boolean);
    }
    const outDir = path.join(EXPORT_DIR, subdir);
    fs.mkdirSync(outDir, { recursive: true });
    let saved = 0;
    const failed = [];
    for (const id of ids) {
      try {
        const url = `${BASE_URL}/invoices/${id}.pdf?api_token=${encodeURIComponent(API_TOKEN)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error();
        const buf = Buffer.from(await resp.arrayBuffer());
        fs.writeFileSync(path.join(outDir, `${id}.pdf`), buf);
        saved += 1;
      } catch {
        failed.push(id);
      }
    }
    return ok({ directory: path.resolve(outDir), downloaded: saved, failed_ids: failed });
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
