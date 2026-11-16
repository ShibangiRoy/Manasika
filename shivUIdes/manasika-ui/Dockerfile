FROM node:22.14-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.14-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/server.mjs ./server.mjs
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/literature-data ./literature-data
RUN mkdir -p /app/data/media && chown -R node:node /app/data
USER node
EXPOSE 4174
CMD ["node", "server.mjs"]
