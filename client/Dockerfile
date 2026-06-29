# ==== Build Stage ====
# Build the Vue app with Vite
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
# Inject API base URL at build time (defaults to /api if not set)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ==== Runtime Stage ====
# Serve static files with nginx, proxy /api to backend
FROM nginx:1.27-alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Use envsubst to inject backend host dynamically
ENV BACKEND_SERVICE=openguardrails-server
ENV BACKEND_PORT=3000

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/health > /dev/null || exit 1

CMD ["/bin/sh", "-c", "envsubst '${BACKEND_SERVICE} ${BACKEND_PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
