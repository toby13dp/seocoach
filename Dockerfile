# ============================================================================
# SEOCoach — Multi-stage Production Dockerfile
# ============================================================================
# Bouwt een geoptimaliseerde productie-image voor de Next.js applicatie.
# Drie stages: deps → builder → runner
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Afhankelijkheden installeren
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps

# Werkmappen vooraf aanmaken (voorkomt permissie-problemen)
RUN mkdir -p /app/node_modules && chown -R node:node /app

WORKDIR /app

# Kopieer package manifests eerst (beter voor Docker layer caching)
COPY package.json bun.lock ./

# Installeer bun voor snellere dependency installatie
RUN npm install -g bun

# Installeer alle afhankelijkheden (inclusief devDependencies voor build)
RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# Stage 2: Next.js applicatie bouwen
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder

WORKDIR /app

# Kopieer afhankelijkheden uit deps stage
COPY --from=deps /app/node_modules ./node_modules

# Kopieer alle broncode
COPY . .

# Bouw de Next.js applicatie (output: standalone)
RUN npm install -g bun && bun run build

# ---------------------------------------------------------------------------
# Stage 3: Productie-runtime (slim image)
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner

# Metadata labels
LABEL maintainer="SEOCoach Team"
LABEL version="1.0.0"
LABEL description="SEOCoach — AI-Driven SEO Automation Platform"
LABEL org.opencontainers.image.title="SEOCoach"
LABEL org.opencontainers.image.description="AI-Driven SEO Automation Platform"
LABEL org.opencontainers.image.version="1.0.0"

# Productie-omgeving instellen
ENV NODE_ENV=production
# Next.js standalone collecteert alles in .next/standalone
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Veilige non-root gebruiker aanmaken
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Werkmappen aanmaken met juiste permissies
RUN mkdir -p /app/.next/standalone && \
    mkdir -p /app/.next/static && \
    mkdir -p /app/public && \
    mkdir -p /app/db && \
    chown -R nextjs:nodejs /app

WORKDIR /app

# Kopieer standalone output (bevat alles wat nodig is voor productie)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma schema en migraties (nodig voor db:push in productie)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Switch naar non-root gebruiker
USER nextjs

# Expose poort 3000
EXPOSE 3000

# Health check — verifieert dat de applicatie reageert
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health/live || exit 1

# Start de Next.js standalone server
CMD ["node", "server.js"]
