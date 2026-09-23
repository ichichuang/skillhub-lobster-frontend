const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipTestFile {
  path: string
  content: string
  encrypted?: boolean
}

function appendUint32(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function appendUint16(bytes: number[], value: number): void {
  bytes.push(value & 0xff, (value >>> 8) & 0xff)
}

export function buildStoreZip(files: ZipTestFile[]): Uint8Array {
  const chunks: number[] = []
  const centralDirectory: number[] = []
  const encoder = new TextEncoder()

  for (const file of files) {
    const nameBytes = encoder.encode(file.path)
    const dataBytes = encoder.encode(file.content)
    const checksum = crc32(dataBytes)
    const flags = file.encrypted ? 1 : 0
    const localHeaderOffset = chunks.length

    appendUint32(chunks, 0x04034b50)
    appendUint16(chunks, 20)
    appendUint16(chunks, flags)
    appendUint16(chunks, 0)
    appendUint16(chunks, 0)
    appendUint16(chunks, 0)
    appendUint32(chunks, checksum)
    appendUint32(chunks, dataBytes.length)
    appendUint32(chunks, dataBytes.length)
    appendUint16(chunks, nameBytes.length)
    appendUint16(chunks, 0)
    for (const byte of nameBytes) chunks.push(byte)
    for (const byte of dataBytes) chunks.push(byte)

    appendUint32(centralDirectory, 0x02014b50)
    appendUint16(centralDirectory, 20)
    appendUint16(centralDirectory, 20)
    appendUint16(centralDirectory, flags)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint32(centralDirectory, checksum)
    appendUint32(centralDirectory, dataBytes.length)
    appendUint32(centralDirectory, dataBytes.length)
    appendUint16(centralDirectory, nameBytes.length)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint32(centralDirectory, 0)
    appendUint32(centralDirectory, localHeaderOffset)
    for (const byte of nameBytes) centralDirectory.push(byte)
  }

  const centralDirectoryOffset = chunks.length
  for (const byte of centralDirectory) chunks.push(byte)
  const centralDirectorySize = chunks.length - centralDirectoryOffset

  appendUint32(chunks, 0x06054b50)
  appendUint16(chunks, 0)
  appendUint16(chunks, 0)
  appendUint16(chunks, files.length)
  appendUint16(chunks, files.length)
  appendUint32(chunks, centralDirectorySize)
  appendUint32(chunks, centralDirectoryOffset)
  appendUint16(chunks, 0)

  return Uint8Array.from(chunks)
}

export function makeZipFile(files: ZipTestFile[], name = 'sample.zip', lastModified = 1): File {
  const bytes = buildStoreZip(files)
  return new File([bytes as BlobPart], name, { type: 'application/zip', lastModified })
}

export function skillMdContent(name: string, description: string, version?: string): string {
  const versionLine = version ? `\nversion: ${version}` : ''
  return `---
name: ${name}
description: ${description}${versionLine}
---

# ${name}
`
}
