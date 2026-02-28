FROM node:20-slim

WORKDIR /app

COPY . .

RUN npm install
RUN npm install square@44 nodemailer exifr

# Fix build script: externalize ALL deps so esbuild doesn't try to bundle them
RUN sed -i 's/const externals = allDeps.filter((dep) => !allowlist.includes(dep));/const externals = allDeps;/' script/build.ts

RUN npx tsx script/build.ts

RUN mkdir -p client/public/uploads/bookings

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
