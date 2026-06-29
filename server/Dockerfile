# ==== OpenGuardrails API Server ====
FROM node:20-alpine

# Install wget for healthcheck
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

WORKDIR /app

# Install dependencies (layer cache)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code & migrations
COPY src/ ./src/
COPY migrations/ ./migrations/

# Set ownership
RUN chown -R appuser:appgroup /app
USER appuser

# Expose API port
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Default: start the API server
CMD ["node", "src/index.js"]
