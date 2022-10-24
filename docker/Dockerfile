FROM node:19-alpine3.15 as build

WORKDIR /api

COPY package*.json ./

RUN npm install

COPY src/ ./src

RUN npm run build

FROM node:19-alpine3.15

WORKDIR /api

COPY --from=build /api/build/ ./build

EXPOSE 3939

CMD [ "node", "build/server.js" ]