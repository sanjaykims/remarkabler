# Multi-stage build for Remarkabler.
#
# Why a Dockerfile (not Nixpacks): Phase 1 of the reMarkable-cloud feature
# needs a Python `.rm` renderer alongside Node, which Nixpacks can't cleanly
# co-install. Base is nikolaik/python-nodejs — it ships Node 20 + Python 3.11
# + build tools (g++/make, needed to compile better-sqlite3's native binding)
# in one image. Builder and runner share the same Debian base so the compiled
# better-sqlite3 binding copied from builder loads in the runner.
#
# Railway auto-detects this Dockerfile and builds with it (railway.json
# builder is DOCKERFILE). $PORT is injected by Railway; `next start` honors it.
# The persistent volume stays mounted at /data (ENV DATA_DIR=/data).

# Shared base so builder and runner can never drift (they MUST match for the
# compiled better-sqlite3 binding copied between stages to load).
ARG BASE=nikolaik/python-nodejs:python3.11-nodejs20

# ---- Builder: install deps + build the Next app ----
FROM ${BASE} AS builder
WORKDIR /app

# Optional CA hook: drop a .crt into docker/certs/ to trust a corporate/proxy
# CA during the build. Ships EMPTY (.gitkeep only) → no-op on Railway.
COPY docker/certs/ /usr/local/share/ca-certificates/extra/
RUN update-ca-certificates || true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The app is force-dynamic and reads secrets lazily at request time, so the
# build needs no real API keys.
RUN npm run build \
    && npm prune --omit=dev

# ---- Runner: app + reMarkable .rm renderer ----
FROM ${BASE}-slim AS runner
WORKDIR /app
# No ENV PORT here on purpose: Railway injects PORT at runtime and `next
# start` honors it (falling back to 3000 when unset). Baking PORT could
# shadow Railway's value.
ENV NODE_ENV=production \
    DATA_DIR=/data \
    NEXT_TELEMETRY_DISABLED=1

# libcairo2 is the only system lib cairosvg needs (SVG -> PDF). Everything
# else in the renderer is pip-installed into an isolated venv.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# reMarkable .rm -> SVG/PDF renderer, isolated in its own venv so it can't
# perturb anything else. Pinned to the versions proven on real v6 samples.
RUN python3 -m venv /opt/renderer \
    && /opt/renderer/bin/pip install --no-cache-dir \
       "rmc==0.3.0" "rmscene==0.6.1" "cairosvg==2.9.0" "svglib" "reportlab" "pypdf"
COPY docker/patch_rm_palette.py /tmp/patch_rm_palette.py
RUN /opt/renderer/bin/python /tmp/patch_rm_palette.py
COPY docker/rm2pdf /usr/local/bin/rm2pdf
RUN chmod +x /usr/local/bin/rm2pdf

# App artifacts from the builder (node_modules already pruned to prod deps;
# includes the compiled better-sqlite3 binding).
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start"]
