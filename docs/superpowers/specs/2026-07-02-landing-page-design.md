# Strona reklamowa (GitHub Pages) + automatyczna aktualizacja przy wydaniu

**Data:** 2026-07-02
**Status:** zatwierdzony

## Cel

Dodać stronę reklamową connectora Fakturownia MCP (pobieranie + instrukcja
użytkowania) hostowaną na GitHub Pages. Strona ma się automatycznie
aktualizować przy każdym nowym wydaniu paczki `.mcpb` (nowa wersja, notatki).

Język: **polski**. Styl: **pełny landing**. Mechanizm wersji: **wstrzykiwanie
przy buildzie**.

## Architektura

```
site/
  index.html   # szablon z tokenami {{VERSION}}, {{WHATS_NEW}}, {{REPO}}, {{DOWNLOAD_URL}}
  styles.css   # style landingu (self-contained, bez zewnętrznych zależności)
  build.mjs    # skrypt Node (tylko wbudowane moduły) → generuje _site/
icon.png       # istniejąca ikona, kopiowana do _site/
.github/workflows/pages.yml  # build + deploy na GitHub Pages
```

### Przycisk pobierania

Zawsze wskazuje stały adres:
`https://github.com/AleksanderDudek/fakturownia-mcp-for-claude/releases/latest/download/fakturownia.mcpb`

GitHub sam przekierowuje ten URL na najnowsze wydanie — link nie wymaga
przebudowy. Build wstrzykuje jedynie numer wersji i sekcję „Co nowego".

### Skrypt buildu (`site/build.mjs`)

Ustala wartości w kolejności:
1. **Wersja** — z env `SITE_VERSION` (workflow przekazuje tag wydania),
   w razie braku z `manifest.json > version`.
2. **Co nowego** — z env `SITE_NOTES` (release notes), w razie braku
   z najnowszej sekcji `CHANGELOG.md` (proste parsowanie nagłówka `## [x.y.z]`
   i punktów listy).
3. **Repo / download URL** — z env `REPO` (`github.repository`), fallback
   na wartość zaszytą w skrypcie.

Wynik: `_site/index.html` (z podstawionymi tokenami) + `styles.css` + `icon.png`.
Minimalny konwerter markdown→HTML dla listy punktów w „Co nowego"
(nagłówki i punkty `-`), z escapowaniem HTML.

## Automatyczna aktualizacja (`.github/workflows/pages.yml`)

Wyzwalacze:
- `release: types: [published]` — główny mechanizm; `release.yml` po pushu tagu
  `v*` tworzy wydanie z plikiem `.mcpb`, co odpala ten workflow z nową wersją.
- `push: branches: [main]`, `paths: [site/**, CHANGELOG.md, manifest.json, icon.png, .github/workflows/pages.yml]`.
- `workflow_dispatch`.

Uprawnienia: `pages: write`, `id-token: write`, `contents: read`.
Concurrency: grupa `pages` (bez anulowania w locie).

Kroki: checkout → setup-node → `node site/build.mjs` (env: `SITE_VERSION`,
`SITE_NOTES` z `github.event.release.*` gdy dostępne, `REPO=${{ github.repository }}`)
→ `actions/configure-pages` → `actions/upload-pages-artifact` (`_site`) →
job deploy: `actions/deploy-pages`.

## Zawartość strony (PL, pełny landing)

1. Hero: ikona, tytuł, hasło, plakietka z wersją, przycisk „Pobierz .mcpb"
   + „Zobacz na GitHubie".
2. Baner „projekt nieoficjalny" (jak w README).
3. „Co to robi" — przykładowe pytania.
4. „Instalacja" — kroki z README (token API, domena, instalacja rozszerzenia).
5. „Narzędzia" — tabela 12 narzędzi.
6. „Bezpieczeństwo" — tryb tylko-odczyt, token w sejfie.
7. „Co nowego" — najnowszy wpis (wstrzykiwany).
8. Stopka — licencja MIT, NOTICE, linki do repo/źródeł.

## Krok ręczny (jednorazowo)

GitHub Pages ustawić na źródło **„GitHub Actions"** (Settings → Pages).
Komenda pomocnicza:
`gh api -X POST repos/AleksanderDudek/fakturownia-mcp-for-claude/pages -f build_type=workflow`
(lub przełącznik w UI). URL: `https://aleksanderdudek.github.io/fakturownia-mcp-for-claude/`.

## Zmiany w repo

- Nowe: `site/index.html`, `site/styles.css`, `site/build.mjs`,
  `.github/workflows/pages.yml`.
- Edycja: `README.md` (link do strony), `CHANGELOG.md` (nowy wpis).

## Poza zakresem (YAGNI)

- Bez wersji EN (projekt jest PL).
- Bez client-side pobierania danych z GitHub API.
- Bez własnej domeny/CNAME (domyślny `github.io`).
- Bez frameworka (czysty HTML/CSS, brak build-toolingu poza jednym skryptem Node).
