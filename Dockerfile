FROM daocloud.io/binsee/wechaty:0.8.243
MAINTAINER binsee <binsee@163.com>

RUN mkdir -p /app/config
WORKDIR /app
COPY package.json .

## 安装及设置时区
RUN apk add --no-cache tzdata \
  && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
  && echo 'Asia/Shanghai' >/etc/timezone

RUN npm config set registry https://registry.npm.taobao.org
RUN npm install --production && npm cache clean && rm -fr /tmp/* /root/.npm
COPY . .

ENV NODE_ENV 'production'
ENV WECHATY_LOG 'info'
ENV DEBUG 'false'
ENV CONFIG_FILE '/app/config/config.js'

VOLUME [ "/app/config" ]

CMD [ "npm" , "start" ]

