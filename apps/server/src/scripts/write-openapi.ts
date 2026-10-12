import { writeFileSync } from 'node:fs';
import { pino } from 'pino';
import { createApp, OPENAPI_INFO } from '../app.js';
import { loadConfig } from '../config/env.js';

/**
 * 生成 OpenAPI 文档：apps/server/openapi.json 是唯一来源，
 * 同时写入 iOS 生成插件要求的同目录副本（harness 检查两者一致）。
 */
const config = loadConfig({});
const app = createApp({
  config,
  logger: pino({ level: 'silent' }),
  database: { ping: async () => true },
});
const document = app.getOpenAPI31Document({
  openapi: OPENAPI_INFO.openapi,
  info: { title: OPENAPI_INFO.title, version: config.version },
});
const content = `${JSON.stringify(document, null, 2)}\n`;
const targets = [
  new URL('../../openapi.json', import.meta.url),
  new URL('../../../ios/MealMuseKit/Sources/MealMuseAPI/openapi.json', import.meta.url),
];
for (const target of targets) {
  writeFileSync(target, content);
}
