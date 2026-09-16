# ---------- Stage 1: Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy only package files first — this is a caching trick.
# Docker caches layers; if package.json hasn't changed, it skips reinstalling.
COPY package*.json ./

RUN npm ci

# Now copy the rest of the source and compile
COPY . .

RUN npm run build

# ---------- Stage 2: Production ----------
FROM node:20-alpine AS production

WORKDIR /app

# Only prod deps this time — no typescript, no tsx, no nodemon
COPY package*.json ./
RUN npm ci --omit=dev

# Pull the compiled JS from the builder stage, nothing else
COPY --from=builder /app/dist ./dist

# Render/most platforms inject PORT — default to 5000 for local runs
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist/index.js"]