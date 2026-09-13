# CDC 旅遊搜尋轉送服務（公開模式）。Cloud Run 的 `gcloud run deploy --source .` 會讀根目錄這個 Dockerfile。
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
# jsdom 在 devDependencies，但轉送服務執行期需要它（解析官方結果），所以不加 --omit=dev
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY backend ./backend
COPY travel-data-core.js ./travel-data-core.js
ENV PUBLIC=1 NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node","backend/server.mjs"]
