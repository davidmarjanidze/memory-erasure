import { execFileSync } from 'node:child_process'
import { copyFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'

import { build } from 'esbuild'

const require = createRequire(import.meta.url)

await rm('dist', { recursive: true, force: true })

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18'
}

await Promise.all([
  build({ ...options, format: 'esm', outfile: 'dist/index.js' }),
  build({ ...options, format: 'cjs', outfile: 'dist/index.cjs' })
])

execFileSync(
  process.execPath,
  [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
  { stdio: 'inherit' }
)
await copyFile('dist/index.d.ts', 'dist/index.d.cts')
