# SEOCoach — Productie Deployment op groenwit.be

## Belangrijk: GitHub Pages ondersteunt dit type app NIET

SEOCoach is een **full-stack Next.js applicatie** met:
- 240 API-route handlers (server-side)
- Prisma ORM database (SQLite/PostgreSQL)
- NextAuth.js authenticatie
- Middleware (rate limiting, CSRF, i18n)

GitHub Pages ondersteunt alleen **statische bestanden** — dit is onvoldoende.
De beste optie is **Vercel** (gratis, native Next.js ondersteuning).

---

## Snelstart: Deploy op Vercel (5 minuten)

### Stap 1: Ga naar Vercel
1. Open [vercel.com](https://vercel.com)
2. Klik **"Sign Up"** → Kies **"Continue with GitHub"**
3. Autoriseer Vercel om je GitHub-repo's te lezen

### Stap 2: Importeer je project
1. Klik **"Add New..."** → **"Project"**
2. Zoek **"toby13dp/seocoach"** in de lijst
3. Klik **"Import"**

### Stap 3: Configureer het project
| Instelling | Waarde |
|---|---|
| Framework Preset | **Next.js** (auto-detect) |
| Root Directory | `./` (standaard) |
| Build Command | `bun run build` |
| Output Directory | `.next` (standaard) |
| Install Command | `bun install` |

### Stap 4: Voeg Environment Variables toe
Klik **"Environment Variables"** en voeg toe:

| Key | Value | Opmerking |
|---|---|---|
| `DATABASE_URL` | `file:./db/custom.db` | Voor SQLite; zie hieronder voor PostgreSQL |
| `NEXTAUTH_SECRET` | *(gegenereerde waarde)* | Zie hieronder |
| `NEXTAUTH_URL` | `https://groenwit.be` | Jouw domein |
| `GOOGLE_CLIENT_ID` | *(indien beschikbaar)* | Optioneel |
| `GOOGLE_CLIENT_SECRET` | *(indien beschikbaar)* | Optioneel |

**NEXTAUTH_SECRET genereren:**
```bash
openssl rand -base64 32
```
Plak de output als waarde voor `NEXTAUTH_SECRET`.

### Stap 5: Deploy
Klik **"Deploy"** — Vercel bouwt en deployed de app automatisch.

### Stap 6: Koppel groenwit.be
1. In Vercel dashboard → Je project → **Settings** → **Domains**
2. Typ `groenwit.be` en klik **"Add"**
3. Vercel toont DNS-records die je moet aanmaken:

**Voor groenwit.be (apex domain):**
| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |

**Voor www.groenwit.be:**
| Type | Name | Value |
|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` |

4. Ga naar je **DNS-beheerder** (waar je domein is geregistreerd)
5. Voeg bovenstaande records toe
6. Wacht tot DNS is gepropageerd (meestal 1-5 minuten, soms tot 24 uur)
7. Vercel genereert automatisch een **gratis SSL-certificaat**

### Stap 7: Update NEXTAUTH_URL
Na het toevoegen van het domein, ga naar:
- **Settings** → **Environment Variables**
- Wijzig `NEXTAUTH_URL` naar `https://groenwit.be`
- Klik **"Redeploy"** op de Deployments-pagina

---

## PostgreSQL voor Productie (Aanbevolen)

SQLite werkt voor development maar is niet ideaal voor productie. Aanbevolen:
**Neon PostgreSQL** (serverless, gratis tier):

1. Ga naar [neon.tech](https://neon.tech) → Sign up
2. Maak een project aan → Kopieer de connection string
3. Vervang `DATABASE_URL` in Vercel met de Neon connection string:
   ```
   postgresql://username:password@ep-xxx.neon.tech/seocoach?sslmode=require
   ```
4. Update Prisma schema provider naar `postgresql`:
   - Vercel doet dit automatisch via de environment variable

---

## Auto-Deploy via GitHub

Na de eerste deployment op Vercel:
- **Elke push naar `main`** → Vercel bouwt en deployed automatisch
- De GitHub Actions workflow (`.github/workflows/deploy.yml`) runt ook CI-checks
- Je hoeft niets handmatig te doen na een code-wijziging

---

## Overzicht: Wat is al gedaan

| Item | Status |
|---|---|
| Code op GitHub (toby13dp/seocoach) | ✅ Gepusht |
| Build errors opgelost | ✅ Fixed |
| Middleware Edge-compatible | ✅ Fixed |
| GitHub Actions CI/CD workflow | ✅ Gemaakt |
| Vercel configuratie (vercel.json) | ✅ Gemaakt |
| Productie-build getest | ✅ Werkt |
| Vercel deployment | ⏳ Jouw account nodig |
| Domein groenwit.be koppelen | ⏳ Na Vercel deployment |
| Google OAuth integratie (Phase 13) | ⏳ Volgende stap |

---

## Alternatieve Hosting

Als Vercel niet gewenst is, zijn dit de opties:

| Platform | Kosten | Docker | Custom Domain |
|---|---|---|---|
| **Railway** | Gratis tier | ✅ | ✅ |
| **Render** | Gratis tier | ✅ | ✅ |
| **Fly.io** | Gratis tier | ✅ | ✅ |
| **VPS (Hetzner/Vultr)** | €4-7/maand | ✅ | ✅ |
| **GitHub Pages** | Gratis | ❌ | Alleen statisch |

Voor VPS deployment gebruik je het bestaande `docker-compose.yml`:
```bash
git clone https://github.com/toby13dp/seocoach.git
cd seocoach
cp .env.example .env
# Vul .env in met productie-waarden
docker compose up -d
```
