# Stage 1: Base image
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Stage 2: Development target (for hot-reload with tsx watch)
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Stage 3: Builder (TypeScript compilation)
FROM dev AS builder
RUN npm run build

# Stage 4: Production target (minimal JS execution runtime)
FROM node:20-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/server.js"]
