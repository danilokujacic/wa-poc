FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# python3/make/g++ are needed to compile bcrypt's native addon against musl libc on Alpine
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build
RUN pnpm prune --prod

FROM base AS production
ENV NODE_ENV=production
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3002
CMD ["node", "dist/main"]
