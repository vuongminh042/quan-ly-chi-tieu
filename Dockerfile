FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY client client
COPY server server
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN pnpm install --prod --filter @chitieu/server... --frozen-lockfile
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
