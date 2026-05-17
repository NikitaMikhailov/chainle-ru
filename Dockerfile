FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN node scripts/build.js

FROM nginx:alpine
COPY --from=builder /app /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/conf.d/default.conf.bak
