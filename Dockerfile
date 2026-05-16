# syntax=docker/dockerfile:1.7
ARG BUN_IMAGE=oven/bun:1.3-alpine
FROM ${BUN_IMAGE} AS base
WORKDIR /app

FROM base AS builder

RUN apk --no-cache upgrade && apk --no-cache add python3 make g++ linux-headers

COPY package.json ./
RUN bun install

COPY . ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM ${BUN_IMAGE} AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/data

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/open-sse ./open-sse
# Next file tracing can omit sibling files; MITM runs server.js as a separate process.
COPY --from=builder /app/src/mitm ./src/mitm
# Standalone node_modules may omit deps only required by the MITM child process.
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge
# Ensure `next` is available at runtime in case tracing did not include it.
COPY --from=builder /app/node_modules/next ./node_modules/next

RUN mkdir -p /app/data && chown -R app:app /app && \
  mkdir -p /app/data-home && chown app:app /app/data-home && \
  ln -sf /app/data-home /root/.9router 2>/dev/null || true

EXPOSE 20128

CMD ["bun", "server.js"]
