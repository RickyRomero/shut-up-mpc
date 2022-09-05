FROM node:14-alpine

ENV NODE_ENV production
LABEL "repository"="https://github.com/RickyRomero/shut-up-mpc"
LABEL "homepage"="https://github.com/RickyRomero/shut-up-mpc"
LABEL "maintainer"="Ricky Romero <ricky.romero@gmail.com>"

WORKDIR /usr/app
COPY .yarn ./.yarn
COPY .yarnrc.yml ./
COPY package.json ./
COPY yarn.lock ./
COPY src ./src

RUN yarn --silent --immutable
RUN mkdir -p /mpc/build /mpc/extension
RUN chown -R 1000:1000 /mpc/build /mpc/extension

ADD entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
