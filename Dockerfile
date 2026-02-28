FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install

RUN npx tsx script/build.ts

RUN mkdir -p client/public/uploads/bookings

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]
