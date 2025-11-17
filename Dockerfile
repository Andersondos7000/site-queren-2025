FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm i -g serve
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]    feat: usar Node serve na porta 3000  Muda Dockerfile para servir dist via serve em 3000 (sem Nginx).
