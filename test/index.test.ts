import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, statfs } from 'node:fs/promises'
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

test('rejects an invalid keepFree', async () => {
  for (const keepFree of [-1, 1.5, NaN, Infinity])
    await assert.rejects(eraseFreeSpace({ directory, keepFree }), RangeError)
})

test('writes nothing when less than keepFree is free', async () => {
  const result = await eraseFreeSpace({
    directory,
    keepFree: Number.MAX_SAFE_INTEGER
  })
  assert.deepEqual(result, { bytesWritten: 0 })
  assert.deepEqual(await readdir(directory), [])
})

test('stops writing once only keepFree is left', async () => {
  const { bavail, bsize } = await statfs(directory)
  const allowed = 1024 * 1024
  const { bytesWritten } = await eraseFreeSpace({
    directory,
    chunkSize: 64 * 1024,
    keepFree: bavail * bsize - allowed
  })
  assert.ok(bytesWritten > 0, 'expected some data to be written')
  // Other programs may free some space meanwhile, so allow a bit of slack.
  assert.ok(bytesWritten <= 4 * allowed, `wrote ${bytesWritten} bytes`)
  assert.deepEqual(await readdir(directory), [])
})

test('rejects a missing directory', async () => {
  await assert.rejects(
    eraseFreeSpace({ directory: join(directory, 'missing') }),
    { code: 'ENOENT' }
  )
})
