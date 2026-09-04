# --- build stage -----------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first so the layer is cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

RUN npm run build

# --- runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="GitHub Org Explorer" \
      org.opencontainers.image.description="React + TypeScript UI for browsing GitHub orgs and repos with a PAT" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
