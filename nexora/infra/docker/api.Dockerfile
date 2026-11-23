FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @nexora/api...
COPY apps/api apps/api
RUN pnpm --filter @nexora/api build

FROM node:22-alpine
WORKDIR /app/apps/api
ENV NODE_ENV=production
# Cliente PostgreSQL para pnpm backup / backup:verify a partir do contentor
RUN apk add --no-cache postgresql16-client
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/
COPY --from=build /app/apps/api/package.json ./
RUN cd /app && pnpm install --frozen-lockfile --prod --filter @nexora/api...
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/drizzle ./drizzle
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
