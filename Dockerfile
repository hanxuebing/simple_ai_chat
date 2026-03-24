FROM harbor.qihoo.net/library/nginx:1.25-alpine
COPY dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["nginx","-g","daemon off;"]
