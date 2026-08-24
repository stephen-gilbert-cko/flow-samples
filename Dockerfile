# Sample implementations of Checkout.com Flow
FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Install production dependencies from the lockfile first so this layer
# is cached across changes to the app code and samples.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application code and the static Flow samples served from /public
COPY config.js server.js ./
COPY public ./public

# The base image ships an unprivileged "node" user
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/config" > /dev/null || exit 1

CMD ["node", "server.js"]
