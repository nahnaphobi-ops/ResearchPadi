# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ---- Runtime stage (static files served by nginx) ----
FROM nginx:1.27-alpine AS runtime

# SPA config tailored for k8s ingress (no internal /api proxy; ingress routes /api)
COPY nginx.k8s.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Drop nginx master process privileges where possible while keeping workers as nginx
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
