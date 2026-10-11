import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, WATCHPACK_POLLING: 'true' },
});
child.on('exit', code => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
