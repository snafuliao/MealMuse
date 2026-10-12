import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/testing/global-setup.ts'],
    // 集成测试共用一个测试库，按文件串行，避免互相清表。
    fileParallelism: false,
  },
});
