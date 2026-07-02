# Wkład w projekt

Dzięki za zainteresowanie! Kilka wskazówek:

## Zgłaszanie błędów
- Sprawdź, czy podobne issue już nie istnieje.
- Podaj system operacyjny i wersję Node.
- Dołącz fragment logów (bez tokenu!).

## Pull requesty
1. Sforkuj repo i utwórz gałąź (`git checkout -b poprawka/nazwa`).
2. Trzymaj się stylu istniejącego kodu (Node ESM, bez zewnętrznych zależności
   ponad SDK MCP i zod).
3. Nowe narzędzie = wpis w README (tabela) + opis w manifeście.
4. Nie dodawaj zależności ze skompilowanymi binariami — psują przenośność `.mcpb`.

## Zasada tylko-odczyt
Ten projekt świadomie **nie** wystawia, nie edytuje ani nie usuwa faktur.
PR-y dodające operacje zapisu nie będą przyjmowane bez osobnej dyskusji
(m.in. ze względu na KSeF i nieodwracalność takich operacji).
