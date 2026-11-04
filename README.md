# memory-erasure

<img src="icon.png" alt="logo" height="200px">

[![npm version](https://img.shields.io/npm/v/memory-erasure.svg)](https://www.npmjs.com/package/memory-erasure)
[![license](https://img.shields.io/npm/l/memory-erasure.svg)](LICENSE)

When you delete a file, its content stays on the disk until something else
is written over it. This package writes random data into all the free space
of a disk and then deletes it, so the content of deleted files can't be
recovered.

Requires Node.js 18 or newer. Works with both `import` and `require`.

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

Note that the disk will be completely full while this runs, so other
programs writing to the same disk may fail during that time.

## API

### `eraseFreeSpace(options?): Promise<EraseResult>`

Options:

| Name         | Type                             | Default       | Description                                                   |
| ------------ | -------------------------------- | ------------- | ------------------------------------------------------------- |
| `directory`  | `string`                         | `os.tmpdir()` | Any directory on the disk you want to wipe. It must exist.    |
| `chunkSize`  | `number`                         | `1048576`     | Bytes per write.                                              |
| `onProgress` | `(bytesWritten: number) => void` |               | Called after every write with the total bytes written so far. |
| `signal`     | `AbortSignal`                    |               | Stops the erasure. The promise rejects with an `AbortError`.  |

Result:

| Name           | Type     | Description                             |
| -------------- | -------- | --------------------------------------- |
| `bytesWritten` | `number` | Bytes written before the disk got full. |

The promise rejects if the directory doesn't exist, can't be written to, or
any error other than "no space left" happens.

## Development

```console
npm run build        # bundle with esbuild and generate type definitions
npm run lint         # eslint and type checking
npm test             # run the tests
npm run npm-publish  # lint, test, build and publish to npm
```

## License

[ISC](LICENSE)
