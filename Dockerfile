FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Build the frontend and backend
RUN npx tsx script/build.ts

# Create uploads directory
RUN mkdir -p client/public/uploads/bookings

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
