FROM node:22-alpine

# Non-root user (the "node" user exists in this image)
RUN mkdir -p /work/backend && chown -R node:node /work
USER node
WORKDIR /work/backend

# Installed at build time, because containers run with no network.
RUN npm init -y > /dev/null \
 && npm install --no-audit --no-fund \
    vitest express mongoose jsonwebtoken bcryptjs cors zod supertest