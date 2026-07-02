# Zmiany

Format zgodny z [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

## [2.1.0] - 2026-07-02
### Zmienione
- Zawężono projekt do connectora dla Claude Desktop. Usunięto stronę,
  configi Codex/Copilot i workflow GitHub Pages.

## [2.0.0] - 2026-07-02
### Zmienione
- Serwer przepisany z Pythona na **Node.js** — eliminuje problem ze
  skompilowanymi zależnościami (`pydantic_core`) i działa na każdej platformie
  bez instalowania Pythona.
- Bundle `.mcpb` nie zawiera już natywnych binariów.

## [1.0.0] - 2026-07-02
### Dodane
- Pierwsza wersja: 12 narzędzi (faktury, należności, VAT, klienci, eksport).
- Bundle `.mcpb` z formularzem konfiguracji (domena + token w sejfie).
