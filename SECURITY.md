# Polityka bezpieczeństwa

## Zgłaszanie podatności

Jeśli znajdziesz problem bezpieczeństwa, **nie otwieraj publicznego issue**.
Napisz na adres z profilu autora lub użyj prywatnego zgłoszenia
(GitHub → Security → *Report a vulnerability*). Postaram się odpowiedzieć
w rozsądnym czasie.

## Zakres

Ten projekt to serwer MCP działający **lokalnie** na maszynie użytkownika.
Nie ma komponentu serwerowego po naszej stronie i nie zbiera żadnych danych.

## Model zaufania

- Token API Fakturowni jest podawany przez użytkownika i przechowywany przez
  Claude Desktop — projekt nigdy go nie loguje ani nie wysyła
  nigdzie poza oficjalne API Fakturowni.
- Serwer działa w trybie **tylko do odczytu** (żądania GET).
- Zależności są przypięte w `package.json`; audytuj je przez `npm audit`.
