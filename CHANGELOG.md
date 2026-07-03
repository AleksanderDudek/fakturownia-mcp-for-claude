# Zmiany

Format zgodny z [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

## [2.2.1] - 2026-07-03
### Zmienione
- `release.yml` po opublikowaniu paczki sam odświeża stronę przez
  `workflow_call` do `pages.yml` (z wersją z tagu). Trigger `release: published`
  nie działał, bo release tworzony przez Actions nie odpala kolejnych workflow.
- Środowisko `github-pages` dopuszcza teraz deploy z tagów `v*` (wcześniej tylko
  z `main`), co odblokowało deploy strony z przebiegu wydania.

## [2.2.0] - 2026-07-02
### Dodane
- Strona reklamowa (landing) hostowana na **GitHub Pages** z instrukcją
  instalacji, listą narzędzi i sekcją bezpieczeństwa. Źródło w `site/`.
- Workflow `pages.yml`: przy każdym opublikowanym wydaniu przebudowuje stronę
  i wstrzykuje aktualną wersję oraz notatki wydania. Przycisk pobierania
  wskazuje stały adres `releases/latest`, więc zawsze prowadzi do najnowszej
  paczki.

### Zmienione
- Zaktualizowano `zod` do **4.x** (z 3.x). MCP SDK 1.29 wspiera zod 4;
  serwer nadal rejestruje wszystkie 12 narzędzi (sprawdzone). `@modelcontextprotocol/sdk`
  pozostaje na `^1.29.0` (już najnowsza).

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
