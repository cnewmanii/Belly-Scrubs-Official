FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install

RUN npx tsx script/build.ts

RUN mkdir -p client/public/uploads/bookings client/public/generated

EXPOSE 5000

ENV NODE_ENV=production

CMD ["sh", "-c", "npx drizzle-kit push 2>&1 || echo 'WARNING: drizzle-kit push failed — tables may already exist'; node dist/index.cjs"]
