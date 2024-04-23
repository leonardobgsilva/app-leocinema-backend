FROM node:14-alpine

WORKDIR /app/backend

COPY ./ ./

RUN npm install

EXPOSE 3333

CMD ["npm", "start"]
