import { randomBytes } from 'node:crypto'
import { mkdtemp, open, rm, statfs } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface EraseOptions {
  /**
   * Directory on the disk that should be wiped. A temporary folder is created
   * inside it and removed when the erasure ends. Defaults to `os.tmpdir()`.
   */
  directory?: string
  /** Size of a single write in bytes. Defaults to 1 MiB. */
  chunkSize?: number
  /**
   * Bytes of free space to leave untouched, so other programs can keep
   * writing to the disk while the erasure runs. Defaults to 1 GiB. Set it to
   * `0` to fill the disk completely.
   */
  keepFree?: number
  /** Called after every write with the total number of bytes written. */
  onProgress?: (bytesWritten: number) => void
  /** Stops the erasure. The returned promise rejects with an `AbortError`. */
  signal?: AbortSignal
}

export interface EraseResult {
  /** Number of bytes written before stopping. */
  bytesWritten: number
}

const DEFAULT_CHUNK_SIZE = 1024 * 1024
// Smallest write worth trying, most file systems allocate 4 KiB blocks.
const MIN_CHUNK_SIZE = 4 * 1024
// Keeps every file below the 4 GiB limit of FAT32.
const MAX_FILE_SIZE = 1024 * 1024 * 1024
const DEFAULT_KEEP_FREE = 1024 * 1024 * 1024
// How often the free space is checked again, other programs may be using it.
const FREE_SPACE_CHECK_INTERVAL = 64 * 1024 * 1024

async function getFreeSpace(path: string): Promise<number> {
  const { bavail, bsize } = await statfs(path)
  return bavail * bsize
}

function isDiskFull(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'ENOSPC' || code === 'EDQUOT'
}

/**
 * Fills the free space of a disk with random data and then deletes it, so
 * the content of previously deleted files can't be recovered.
 */
export async function eraseFreeSpace(
  options: EraseOptions = {}
): Promise<EraseResult> {
  const {
    directory = tmpdir(),
    chunkSize = DEFAULT_CHUNK_SIZE,
    keepFree = DEFAULT_KEEP_FREE,
    onProgress,
    signal
  } = options

  if (!Number.isInteger(chunkSize) || chunkSize <= 0)
    throw new RangeError('chunkSize must be a positive integer')
  if (!Number.isSafeInteger(keepFree) || keepFree < 0)
    throw new RangeError('keepFree must be a non-negative integer')

  signal?.throwIfAborted()

  const data = randomBytes(chunkSize)
  const minChunkSize = Math.min(chunkSize, MIN_CHUNK_SIZE)
  const folder = await mkdtemp(join(directory, 'memory-erasure-'))
  let bytesWritten = 0
  let size = chunkSize
  // Bytes that can still be written before the free space has to be checked.
  let budget = keepFree > 0 ? 0 : Infinity
  let writtenSinceCheck = 0

  try {
    for (let index = 0; ; index++) {
      let file
      try {
        file = await open(join(folder, String(index)), 'w')
      } catch (error) {
        if (isDiskFull(error)) return { bytesWritten }
        throw error
      }

      try {
        let fileSize = 0
        while (fileSize < MAX_FILE_SIZE) {
          signal?.throwIfAborted()

          if (
            keepFree > 0 &&
            (budget < size || writtenSinceCheck >= FREE_SPACE_CHECK_INTERVAL)
          ) {
            budget = Math.max(0, (await getFreeSpace(folder)) - keepFree)
            writtenSinceCheck = 0
            if (budget < minChunkSize) return { bytesWritten }
          }

          let written: number
          try {
            ;({ bytesWritten: written } = await file.write(
              data,
              0,
              Math.min(size, budget)
            ))
          } catch (error) {
            if (!isDiskFull(error)) throw error
            // Retry with smaller writes to fill the last bits of free space.
            if (size === minChunkSize) return { bytesWritten }
            size = Math.max(minChunkSize, Math.floor(size / 2))
            continue
          }

          fileSize += written
          bytesWritten += written
          budget -= written
          writtenSinceCheck += written
          onProgress?.(bytesWritten)
        }
      } finally {
        // Make sure the data actually reaches the disk before it gets deleted.
        await file.sync().catch(() => {})
        await file.close()
      }
    }
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}
