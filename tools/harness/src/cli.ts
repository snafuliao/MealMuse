import { fileURLToPath } from 'node:url';
import { format, RULES, runAll } from './index.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const violations = runAll(root);

if (violations.length === 0) {
  process.stdout.write(`harness: ${RULES.length} 条规则全部通过\n`);
} else {
  process.stderr.write(
    `${violations.map(format).join('\n\n')}\n\nharness: ${violations.length} 处违规\n`,
  );
  process.exitCode = 1;
}
