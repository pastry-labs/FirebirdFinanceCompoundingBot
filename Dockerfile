FROM alpine

ENV GOOGLE_APPLICATION_CREDENTIALS /home/node/code/serviceAccountKey.json

RUN apk --no-cache update && \
    apk --no-cache upgrade && \
	apk --no-cache add tzdata openntpd

RUN apk add --update bash
RUN apk add --update build-base
RUN apk add --update nodejs npm
RUN apk add --update python3
RUN addgroup -S node && adduser -S node -G node
USER node
RUN mkdir /home/node/code
WORKDIR /home/node/code
COPY --chown=node:node package-lock.json package.json ./
RUN npm ci
COPY --chown=node:node . .
CMD ["node", "main.js"]