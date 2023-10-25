FROM node:20.8.1 as build
WORKDIR /app
COPY package*.json .
COPY prisma ./prisma/
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20.8.1
WORKDIR /app
COPY package.json .
RUN npm install --only=production --legacy-peer-deps
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./
ENV NODE_ENV production
RUN npx prisma generate
CMD npm run start:prod
