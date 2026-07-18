# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Copy only manifests first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev=false

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for the runtime image
RUN npm prune --omit=dev

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# tini for proper signal handling / zombie reaping
RUN apk add --no-cache tini

# Non-root user
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app
EXPOSE 5000

# Graceful shutdown: tini forwards SIGTERM to the node process
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
