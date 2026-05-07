# Build context is the repo ROOT (Railway Root Directory = ".") so we
# can pull in both frontend/ and docs/. The Vite docs page imports
# `@docs/*.md?raw` which resolves to ../docs relative to frontend —
# that path needs to be in the upload.

FROM node:20-alpine AS build
WORKDIR /repo
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm install --no-audit --no-fund
COPY frontend ./frontend
COPY docs ./docs
# `@root/CONTRIBUTING.md?raw` is bundled into the in-site docs page.
COPY CONTRIBUTING.md ./
# Vite reads import.meta.env.VITE_* at build time. Railway forwards
# service variables to the builder as build args, so we have to
# declare them with ARG and re-emit as ENV for the RUN step to see
# them. Without these, the bundle ships with empty defaults and
# fetch(`${API_BASE}/api/v1/...`) hits the frontend's own domain.
ARG VITE_API_BASE
ARG VITE_RPC_URL
ENV VITE_API_BASE=$VITE_API_BASE \
    VITE_RPC_URL=$VITE_RPC_URL \
    NODE_OPTIONS="--max-old-space-size=4096"
RUN cd frontend && npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /repo/frontend/dist ./dist
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "exec serve -s dist -l ${PORT}"]
