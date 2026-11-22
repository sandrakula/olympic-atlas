FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:/unmounted-build-data/olympic-atlas.db
RUN npm run db:generate && npm run build \
    && node -e "const Db = require('better-sqlite3'); const db = new Db(':memory:'); db.exec('CREATE VIRTUAL TABLE search_probe USING fts5(term)'); db.close()"

FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=file:/data/olympic-atlas.db \
    PORT=3000
COPY --from=build /app/package.json /app/prisma.config.ts /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next-atlas ./.next-atlas
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/lib/sqlite-url.ts ./src/lib/sqlite-url.ts
COPY --from=build /app/scripts/production-db.mjs /app/scripts/start-production.sh ./scripts/
EXPOSE 3000
CMD ["sh", "./scripts/start-production.sh"]
