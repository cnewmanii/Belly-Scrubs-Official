FROM node:20-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Copy source code
COPY . .

# Build the frontend and backend
RUN npx tsx script/build.ts

# Create uploads directory
RUN mkdir -p client/public/uploads/bookings

# Expose the port
EXPOSE 5000

# Start the server
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
