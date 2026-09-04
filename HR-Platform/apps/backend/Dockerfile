# XAVFSIZLIK-AUDIT.md O-6/O-7: this used to be a single stage that (a) ran
# as root with no USER directive at all — combined with K-2 (the device
# events route's old arbitrary-file-write bug), that meant an attacker who
# found a write primitive could overwrite a source .js file with the
# process's own full container-root privileges — and (b) installed with
# `pnpm install --frozen-lockfile` (dev dependencies included) then
# `COPY . .`'d the entire repo (tests, scripts, .git-adjacent files) into
# the image that actually runs in production, needlessly widening what's
# reachable if the container is ever compromised some other way.

FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
# pnpm-workspace.yaml — bog'liqlik override'lari shu yerda (XAVFSIZLIK-AUDIT.md
# 4-pass, T-2: `qs` majburan tuzatilgan versiyaga ko'tariladi). pnpm 10+ dan
# beri overrides package.json'da EMAS, shu faylda o'qiladi — u nusxalanmasa,
# build ogohlantirish ham bermasdan zaif versiyani o'rnatib qo'yardi.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Full (dev+prod) install here only — needed for nothing in this project
# today (no build/compile step), kept as a stage so a future build step
# (TypeScript, bundling, etc.) has somewhere to run without touching the
# runtime stage below.
RUN pnpm install --frozen-lockfile
COPY . .

FROM node:20-alpine AS runtime
WORKDIR /app
RUN npm install -g pnpm

# pnpm-workspace.yaml — bog'liqlik override'lari shu yerda (XAVFSIZLIK-AUDIT.md
# 4-pass, T-2: `qs` majburan tuzatilgan versiyaga ko'tariladi). pnpm 10+ dan
# beri overrides package.json'da EMAS, shu faylda o'qiladi — u nusxalanmasa,
# build ogohlantirish ham bermasdan zaif versiyani o'rnatib qo'yardi.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --prod: no devDependencies in the image that actually runs in production.
RUN pnpm install --frozen-lockfile --prod

# Only the application source, not the builder stage's full checkout (no
# .git, no scratch/test artifacts that might exist in the working tree).
COPY --from=builder /app/src ./src

# The `node` user/group (uid/gid 1000) already exists in the base image.
# `uploads` is created and owned by it up front so the app can still write
# there at runtime without ever needing root to do so.
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["pnpm", "start"]
