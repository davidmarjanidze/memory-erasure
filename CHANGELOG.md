# 2.0.1 (2026-11-04)

Export `package.json`, so `require('memory-erasure/package.json')` works.

# 2.0.0 (2026-11-04)

Breaking changes:

- Replace `eraseMemory(cb)` with `eraseFreeSpace(options)`, which returns a
  promise and doesn't block the event loop
- Add the `directory`, `chunkSize`, `onProgress` and `signal` options
- Throw errors instead of passing them to a callback or logging them

Other changes:

- Write random bytes instead of random digits
- Fill the last bits of free space with smaller writes
- Flush the data to the disk before deleting it
- Always remove the temporary files, including on abort and errors
- Fix the CommonJS build, which used `import.meta.url`
- Replace Rollup with esbuild
- Move to ESLint 10 and TypeScript 6
- Add tests

# 1.3.0 (2023-06-10)

Remove the downloads tag from `README.md`.

# 1.2.0 (2023-04-30)

- Add Rollup config
- Add ESLint
- Add the support for CJS
- Add TypeScript definition file
