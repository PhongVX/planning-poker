FROM node:14.17-alpine as builder 
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "run","start"]
