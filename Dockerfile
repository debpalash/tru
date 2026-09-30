FROM oven/bun:1.4.0
WORKDIR /app
COPY --chown=bun:bun server ./server
RUN mkdir -p /var/lib/tru && chown bun:bun /var/lib/tru && chmod 700 /var/lib/tru
ENV TRU_DATA_DIR=/var/lib/tru
ENV TRU_LISTEN_HOST=0.0.0.0
USER bun
EXPOSE 8788
CMD ["bun", "server/start.ts"]
