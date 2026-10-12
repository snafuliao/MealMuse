import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type Secrets = {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
};

const VERSION = 'v1';

export class SecretsUnavailableError extends Error {
  constructor() {
    super(
      'MODEL_SECRETS_KEY 未配置或无效。修复：运行 openssl rand -base64 32，把结果写入 .env 的 MODEL_SECRETS_KEY 后重启服务。',
    );
  }
}

/** AES-256-GCM 加密。密文格式：v1:<iv>:<tag>:<data>（均为 base64）。 */
export function createSecrets(base64Key: string | null): Secrets {
  const key = base64Key ? Buffer.from(base64Key, 'base64') : null;
  const requireKey = () => {
    if (!key || key.length !== 32) throw new SecretsUnavailableError();
    return key;
  };
  return {
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', requireKey(), iv);
      const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return [VERSION, iv, cipher.getAuthTag(), data]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64')))
        .join(':');
    },
    decrypt(ciphertext) {
      const [version, iv, tag, data] = ciphertext.split(':');
      if (version !== VERSION || !iv || !tag || !data) {
        throw new Error('无法识别的密文格式');
      }
      const decipher = createDecipheriv('aes-256-gcm', requireKey(), Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
