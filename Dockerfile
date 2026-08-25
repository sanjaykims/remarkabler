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

# Keep these as separate, registry-verified digest references. They must
# remain ABI-compatible: same Node major,
# architecture, libc, and Debian generation, because the runner loads the
# better-sqlite3 native binding compiled in the builder.
ARG BUILDER_BASE=nikolaik/python-nodejs:python3.11-nodejs20@sha256:8f958bdc1b4a422bfafd97cab4f69836401f616ae985d4b57a53d254f5bcb038
ARG RUNNER_BASE=nikolaik/python-nodejs:python3.11-nodejs20-slim@sha256:df03d7d77b520788713dec8c99464d33e431e78256b6950f52ad99561dd09412

# ---- Builder: install deps + build the Next app ----
FROM ${BUILDER_BASE} AS builder
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
# build needs no real API keys — EXCEPT the PostHog NEXT_PUBLIC_* vars, which
# Next inlines at BUILD time. Under Nixpacks these came from Railway's env;
# under Docker they must arrive as build args (Railway passes service vars as
# build args for Dockerfile builds). Default empty → analytics simply stays
# off if unset, same as before. Re-exposed as ENV so `next build` inlines them.
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
RUN npm run build \
    && npm prune --omit=dev

# ---- Runner: app + reMarkable .rm renderer ----
FROM ${RUNNER_BASE} AS runner
WORKDIR /app
# No ENV PORT here on purpose: Railway injects PORT at runtime and `next
# start` honors it (falling back to 3000 when unset). Baking PORT could
# shadow Railway's value.
ENV NODE_ENV=production \
    DATA_DIR=/data \
    HOME=/home/remarkabler \
    NEXT_TELEMETRY_DISABLED=1

# gosu lets the entrypoint repair ownership on a freshly mounted Railway
# volume and then replace itself with the unprivileged app process. libcairo2
# is the system lib cairosvg needs (SVG -> PDF). fontconfig +
# Noto CJK matter for TYPED text on reMarkable pages (Type Folio / convert-
# to-text): handwritten strokes are font-independent vector polylines, but a
# typed Korean passage in the SVG renders as empty tofu boxes without a CJK
# font — OCR then reads nothing and the passage silently vanishes from the
# transcription. Everything else in the renderer is pip-installed into an
# isolated venv.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       gosu libcairo2 fontconfig fonts-noto-cjk fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

# Use a stable numeric identity so files on the persistent volume retain a
# meaningful owner across image releases. The entrypoint starts as root only
# long enough to reconcile mount ownership, then drops privileges permanently.
RUN groupadd --gid 10001 remarkabler \
    && useradd --uid 10001 --gid remarkabler --create-home \
       --home-dir /home/remarkabler --shell /usr/sbin/nologin remarkabler

# reMarkable .rm -> SVG/PDF renderer, isolated in its own venv so it can't
# perturb anything else. Pinned to the versions proven on real v6 samples.
#
# rmscene is deliberately OVERRIDDEN to 0.8.0 past rmc 0.3.0's <0.7 cap:
# 0.6.1 warned "data has not been read (newer format)" on 2026-firmware pages
# and silently DROPPED those strokes — a whole diary section went missing in
# the first cloud import. Verified on real samples that rmc 0.3.0 + rmscene
# 0.8.0 renders identical strokes (only z-order shifts) with no unread-data
# warnings. The trailing import asserts the override actually took.
RUN python3 -m venv /opt/renderer \
    && /opt/renderer/bin/pip install --no-cache-dir \
       "rmc==0.3.0" "cairosvg==2.9.0" "svglib" "reportlab" "pypdf" \
    && /opt/renderer/bin/pip install --no-cache-dir "rmscene==0.8.0" \
    && /opt/renderer/bin/python -c "import rmc, rmscene; import importlib.metadata as im; v = im.version('rmscene'); assert v == '0.8.0', v"
COPY docker/patch_rm_palette.py /tmp/patch_rm_palette.py
RUN /opt/renderer/bin/python /tmp/patch_rm_palette.py
COPY docker/rm2pdf /usr/local/bin/rm2pdf
RUN chmod +x /usr/local/bin/rm2pdf

# App artifacts from the builder (node_modules already pruned to prod deps;
# includes the compiled better-sqlite3 binding).
# Keep executable application code root-owned. Only Next's runtime cache and
# the separately mounted DATA_DIR need to be writable by the app process.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
RUN mkdir -p /app/.next/cache \
    && chown -R remarkabler:remarkabler /app/.next/cache

# Fail the BUILD, not the boot, if the two base digests ever drift apart.
# better-sqlite3 is a native module compiled against the builder's Node/glibc;
# nothing but a comment enforces that the runner stays ABI-compatible, so a
# future one-sided digest bump would produce an image that builds cleanly and
# then dies on first request — with the diary offline until someone notices.
RUN node -e "require('better-sqlite3'); console.log('better-sqlite3 ABI OK')"

COPY docker/entrypoint.sh /usr/local/bin/remarkabler-entrypoint
RUN chmod 0755 /usr/local/bin/remarkabler-entrypoint

EXPOSE 3000
ENTRYPOINT ["remarkabler-entrypoint"]
CMD ["npm", "run", "start"]
