FROM node:18-bullseye-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
  && apt-get install -y python3 build-essential libsqlite3-dev curl --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# install deps
COPY package.json package-lock.json* ./
RUN npm install --production --no-audit --no-fund

# copy app
COPY . .

EXPOSE 3000


HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
