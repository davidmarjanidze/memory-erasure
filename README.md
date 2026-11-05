# memory-erasure

<img src="icon.png" alt="logo" height="200px">

[![npm version](https://img.shields.io/npm/v/memory-erasure.svg)](https://www.npmjs.com/package/memory-erasure)
[![license](https://img.shields.io/npm/l/memory-erasure.svg)](LICENSE)

When you delete a file, its content stays on the disk until something else
is written over it. This package writes random data into all the free space
of a disk and then deletes it, so the content of deleted files can't be
recovered. It's meant for the case where you've just removed sensitive data
and want it gone for good.

Requires Node.js 18.15 or newer. Works with both `import` and `require`.

## Installation

```console
npm i memory-erasure
```

## Usage

```ts
import { eraseFreeSpace } from 'memory-erasure'

const { bytesWritten } = await eraseFreeSpace({
  directory: '/Volumes/MyDisk',
  onProgress: (bytes) => console.log(`${(bytes / 1e9).toFixed(2)} GB`)
})

console.log(`Done, overwrote ${(bytesWritten / 1e9).toFixed(2)} GB`)
```

To stop before the disk is full, pass an `AbortSignal`:

```ts
const controller = new AbortController()

eraseFreeSpace({ signal: controller.signal }).catch((error) => {
  if (error.name !== 'AbortError') throw error
})

controller.abort()
```

The temporary files are removed in every case: when the disk is full, when
it's aborted and when an error happens.

By default 1 GiB of free space is left untouched, so other programs can
keep writing to the disk while this runs. The free space is checked again
every 64 MiB, so it adapts if other programs use some of it in the meantime.
Change the amount with `keepFree`:

```ts
// Leave 5 GiB free
await eraseFreeSpace({ keepFree: 5 * 1024 * 1024 * 1024 })

// Fill the disk completely
await eraseFreeSpace({ keepFree: 0 })
```

Deleted data in the space that's left free isn't overwritten. Use
`keepFree: 0` if you need every byte wiped, but note that the disk will then
be completely full for a while and other programs writing to it may fail.

## API

### `eraseFreeSpace(options?): Promise<EraseResult>`

Options:

| Name         | Type                             | Default       | Description                                                   |
| ------------ | -------------------------------- | ------------- | ------------------------------------------------------------- |
| `directory`  | `string`                         | `os.tmpdir()` | Any directory on the disk you want to wipe. It must exist.    |
| `chunkSize`  | `number`                         | `1048576`     | Bytes per write.                                              |
| `keepFree`   | `number`                         | `1073741824`  | Bytes of free space to leave untouched (1 GiB).               |
| `onProgress` | `(bytesWritten: number) => void` |               | Called after every write with the total bytes written so far. |
| `signal`     | `AbortSignal`                    |               | Stops the erasure. The promise rejects with an `AbortError`.  |

Result:

| Name           | Type     | Description                    |
| -------------- | -------- | ------------------------------ |
| `bytesWritten` | `number` | Bytes written before stopping. |

The promise rejects if the directory doesn't exist, can't be written to, or
any error other than "no space left" happens.

## License

[ISC](LICENSE)
