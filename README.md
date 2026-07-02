<div align="center">

<img src="icon.png" alt="Fakturownia MCP" width="120" height="120" />

# Fakturownia MCP

**Nieoficjalny serwer [MCP](https://modelcontextprotocol.io) dla [Fakturowni](https://fakturownia.pl)** — pytaj o faktury, należności, obroty i VAT w naturalnym języku, wprost w Claude Desktop.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A518-brightgreen.svg)](https://nodejs.org)
[![status](https://img.shields.io/badge/status-read--only-success.svg)](#bezpieczeństwo)

[**Strona projektu →**](https://aleksanderdudek.github.io/fakturownia-mcp-for-claude/) · [Pobierz najnowsze wydanie](../../releases/latest)

</div>

---

> [!IMPORTANT]
> **Projekt nieoficjalny.** Nie jest tworzony ani wspierany przez Fakturownia sp. z o.o.
> Korzysta z [publicznego API Fakturowni](https://github.com/fakturownia/API).
> Szczegóły w [NOTICE.md](NOTICE.md). Serwer działa **wyłącznie w trybie odczytu**.

## Co to robi

Zamiast klikać po panelu Fakturowni, pytasz Claude:

- *„Kto mi nie zapłacił i ile jest po terminie?"*
- *„Jaki był obrót w czerwcu? Porównaj z majem."*
- *„Kto jest moim największym klientem w tym roku?"*
- *„Rozbij sprzedaż VAT za II kwartał."*
- *„Wyeksportuj wszystkie faktury z 2026 do CSV."*

Serwer łączy się z Twoim kontem przez API i liczy odpowiedzi po swojej stronie
(salda, przeterminowania, rankingi), więc wyniki są szybkie i spójne.

## Instalacja (Claude Desktop)

Najpierw weź **Kod autoryzacyjny API** z Fakturowni:
**Ustawienia → Ustawienia konta → Integracja → Kod autoryzacyjny API**.
Zapamiętaj też swoją **domenę** — część przed `.fakturownia.pl`
(dla `mojafirma.fakturownia.pl` to `mojafirma`).

Potem:

1. Pobierz `fakturownia.mcpb` z [najnowszego wydania](../../releases/latest).
2. W Claude Desktop otwórz **Ustawienia → Extensions → Install Extension…** i wskaż plik.
   Na macOS możesz też dwukrotnie kliknąć plik.
3. W okienku wpisz **domenę** i **token**. Token trafia do systemowego sejfu
   (Keychain / Credential Manager) — nie do pliku tekstowego.
4. Sprawdź w rozmowie: *„Pokaż obrót z tego miesiąca"*.

Nie musisz instalować Node.js — Claude Desktop dostarcza własny. Paczka jest
niepodpisana, więc przy instalacji zobaczysz „nieznany wydawca" (normalne przy
dystrybucji spoza oficjalnego katalogu).

## Narzędzia

| Narzędzie | Pytanie, na które odpowiada |
|---|---|
| `list_invoices` | „Pokaż faktury z czerwca / największe tego roku" |
| `find_invoice` | „Znajdź fakturę FV/2026/06/12" |
| `unpaid_invoices` | „Kto nie zapłacił? Co po terminie?" (salda + wiekowanie) |
| `revenue_summary` | „Ile wystawiłem w tym miesiącu?" (netto/VAT/brutto) |
| `vat_breakdown` | „Rozbij sprzedaż po stawkach VAT" (pod JPK) |
| `compare_periods` | „Porównaj ten miesiąc z poprzednim" |
| `top_clients` | „Kto jest moim największym klientem?" |
| `client_invoices` | „Faktury klienta X i jego saldo" |
| `list_products` | Cennik i stany magazynowe |
| `list_payments` | Wpłaty i rozliczenia z okresu |
| `export_invoices_csv` | Eksport faktur do CSV |
| `download_invoice_pdfs` | Hurtowe pobranie PDF-ów |

Okresy (`period`): `all`, `this_month`, `last_month`, `last_30_days`,
`this_year`, `last_year`, `last_12_months`, `more` (+ `date_from`/`date_to`).

## Bezpieczeństwo

- **Tylko odczyt.** Serwer wykonuje wyłącznie zapytania GET — nie wystawia,
  nie edytuje ani nie usuwa faktur.
- **Token zostaje u Ciebie.** Podajesz go przy instalacji; trafia do systemowego
  sejfu. Nigdy nie jest wysyłany poza oficjalne API Fakturowni.
- **Kod jest jawny i audytowalny.** Cały serwer to jeden plik
  [`src/index.js`](src/index.js) bez zaciemniania. Paczkę `.mcpb` możesz
  rozpakować (to zwykły ZIP) i sprawdzić zawartość.
- **Brak natywnych binariów.** Zależności to czysty JavaScript.
- Jeśli token wycieknie — wygeneruj nowy w ustawieniach Fakturowni.

## Budowanie ze źródeł

```bash
npm install
npm install -g @anthropic-ai/mcpb   # jednorazowo
npm run build                        # tworzy dist/fakturownia.mcpb
```

## Licencja

[MIT](LICENSE) © 2026 Aleksander Dudek. „Fakturownia" — znak towarowy właściciela,
użyty opisowo. Zobacz [NOTICE.md](NOTICE.md).
