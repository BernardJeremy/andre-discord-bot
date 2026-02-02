# Builder stage
FROM node:lts-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

RUN yarn run build

# Runner stage
FROM node:lts-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install ONLY production dependencies
RUN yarn install --production --frozen-lockfile

# Copy built application from builder
COPY --from=builder /app/dist ./dist

CMD ["yarn", "start"]
