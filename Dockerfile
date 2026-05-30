FROM node:22-alpine

WORKDIR /app

RUN npm install -g pnpm@11.3.0

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY server ./server
COPY public ./public

ENV BIND_HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
