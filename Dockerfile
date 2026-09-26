# Public evidence viewer. Browser execution stays in the local development app.
FROM node:24-bookworm-slim
WORKDIR /app
RUN npm install --global pnpm@11.2.2
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY fixtures ./fixtures
COPY examples ./examples
COPY scripts ./scripts
COPY docs/demo-evidence ./docs/demo-evidence
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4001 MING_PUBLIC_DEMO=1
EXPOSE 4001
CMD ["node", "scripts/start.mjs"]
