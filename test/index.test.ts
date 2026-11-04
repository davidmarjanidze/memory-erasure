import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { eraseFreeSpace } from '../src/index.ts'

let directory: string

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'memory-erasure-test-'))
})

after(async () => {
  await rm(directory, { recursive: true, force: true })
})

test('reports progress and cleans up after being aborted', async () => {
  const controller = new AbortController()
  const progress: number[] = []

  await assert.rejects(
    eraseFreeSpace({
      directory,
      chunkSize: 1024,
      signal: controller.signal,
      onProgress: (bytesWritten) => {
        progress.push(bytesWritten)
        if (bytesWritten >= 10 * 1024) controller.abort()
      }
    }),
    { name: 'AbortError' }
  )

  assert.deepEqual(
    progress,
    Array.from({ length: 10 }, (_, i) => (i + 1) * 1024)
  )
  assert.deepEqual(await readdir(directory), [])
})

test('does nothing when the signal is already aborted', async () => {
  await assert.rejects(
    eraseFreeSpace({ directory, signal: AbortSignal.abort() }),
    { name: 'AbortError' }
  )
  assert.deepEqual(await readdir(directory), [])
})

test('rejects an invalid chunk size', async () => {
  for (const chunkSize of [0, -1, 1.5, NaN])
    await assert.rejects(eraseFreeSpace({ directory, chunkSize }), RangeError)
})

test('rejects a missing directory', async () => {
  await assert.rejects(
    eraseFreeSpace({ directory: join(directory, 'missing') }),
    { code: 'ENOENT' }
  )
})
