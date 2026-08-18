# Vercel-Deployment

Dieses Paket ist für npm vorbereitet.

- `package-lock.json` ist **gültig und darf nicht geleert werden**.
- In Vercel keinen eigenen Install-Befehl erzwingen; Standard verwenden (`npm install` bzw. automatisch erkannt).
- Framework Preset: Next.js
- Root Directory: leer bzw. `.` (dort liegt `package.json`)
- Node.js wird über `package.json` auf `24.x` festgelegt.
- Die Umgebungsvariable `ENABLE_EXPERIMENTAL_COREPACK` wird für dieses Paket nicht benötigt und kann entfernt werden.
- Der Vercel-Hobby-Cron enthält nur den wöchentlichen Sonntagsbericht. Häufige Push-Erinnerungen müssen separat über Supabase eingerichtet werden.
