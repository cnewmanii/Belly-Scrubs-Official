FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --ignore-scripts

COPY . .

RUN npx tsx script/build.ts

RUN mkdir -p client/public/uploads/bookings

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
