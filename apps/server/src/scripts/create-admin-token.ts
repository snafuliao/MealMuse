import { parseArgs } from 'node:util';
import { DisplayNameSchema } from '@mealmuse/shared';
import { createServices } from '../composition.js';
import { loadConfig } from '../config/env.js';

/**
 * 签发管理端登录令牌（只显示一次）。同名管理员已存在则复用。
 * 用法：pnpm --filter @mealmuse/server admin:token --name 站长
 */
const { values } = parseArgs({ options: { name: { type: 'string', default: '管理员' } } });
const displayName = DisplayNameSchema.parse(values.name);

const services = createServices(loadConfig());
try {
  const { token, user } = await services.identity.issueAdminToken(displayName);
  process.stdout.write(
    `管理员：${user.displayName}（${user.id}）\n登录令牌（只显示这一次，请妥善保存）：\n${token}\n`,
  );
} finally {
  await services.shutdown();
}
