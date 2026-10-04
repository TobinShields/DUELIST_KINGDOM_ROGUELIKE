FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY goat-simulador.html /usr/share/nginx/html/index.html
COPY deckbuilder.html /usr/share/nginx/html/deckbuilder.html

EXPOSE 80
