# Multi-stage build:
#   1) build the static SPA with Vite
#   2) serve dist/ with `serve -s` so unknown routes fall back to
#      index.html (SPA routing). Railway-friendly — binds to ${PORT}.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (not ci) because the wallet-adapter peer-dep graph
# resolves slightly differently on Alpine Linux than on the dev box,
# and `npm ci`'s strict lock-equality check trips on the divergence.
RUN npm install --no-audit --no-fund
COPY . .
# VITE_API_BASE / VITE_RPC_URL are baked into the bundle at build
# time. Railway forwards build-time env vars by default, so the values
# the dashboard sets land in import.meta.env.* here.
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "exec serve -s dist -l ${PORT}"]
