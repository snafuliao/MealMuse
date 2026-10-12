import { createHash, randomBytes, randomInt } from 'node:crypto';

/** 去掉易混淆字符（0/O、1/I/L）的邀请码字母表。 */
const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** 形如 ABCD-2345 的 8 位邀请码。 */
export function generateInviteCode(): string {
  const chars = Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

/** 用户输入的邀请码：忽略大小写、空格和连字符。 */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function generateDeviceToken(): string {
  return `mm_${randomBytes(32).toString('base64url')}`;
}
