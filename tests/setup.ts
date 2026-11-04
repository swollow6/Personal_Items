import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { Blob as NodeBlob } from 'node:buffer'
import { TextEncoder, TextDecoder } from 'node:util'
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
Object.assign(globalThis, { Blob: NodeBlob, TextEncoder, TextDecoder })
