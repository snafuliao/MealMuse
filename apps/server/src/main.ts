import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createServices } from './composition.js';

const config = loadConfig();
const services = createServices(config);
const { providers } = services;
const app = createApp(services);

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  providers.logger.info({ port: info.port, version: config.version }, 'server started');
});

/** 优雅退出：停止接收新请求，关闭数据库连接，超时强制退出。 */
function shutdown(signal: string) {
  providers.logger.info({ signal }, 'shutting down');
  const force = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    void services.shutdown().finally(() => {
      clearTimeout(force);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
