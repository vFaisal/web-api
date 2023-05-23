FROM node:18.16.0 as build
WORKDIR /app
COPY package*.json .
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npm run build

FROM node:18.16.0
WORKDIR /app
COPY package.json .
RUN npm install --only=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./
ENV NODE_ENV production
RUN npx prisma generate
CMD npm run start:prod
