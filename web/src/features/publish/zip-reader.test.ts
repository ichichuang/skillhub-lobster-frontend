import { describe, expect, it } from 'vitest'
import { openZipArchive, ZipReadError } from './zip-reader'
import { buildStoreZip, crc32, skillMdContent } from './zip-test-builder'

const hasDeflateSupport = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

async function deflateRawBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function storeBlob(files: Array<{ path: string; content: string }>): Blob {
  return new Blob([buildStoreZip(files) as BlobPart], { type: 'application/zip' })
}

async function buildDeflateZip(files: Array<{ path: string; content: string }>): Promise<Uint8Array> {
  const chunks: number[] = []
  const centralDirectory: number[] = []
  const encoder = new TextEncoder()

  const appendUint16 = (target: number[], value: number) => target.push(value & 0xff, (value >>> 8) & 0xff)
  const appendUint32 = (target: number[], value: number) =>
    target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)

  for (const file of files) {
    const nameBytes = encoder.encode(file.path)
    const rawBytes = encoder.encode(file.content)
    const compressed = await deflateRawBytes(rawBytes)
    const localHeaderOffset = chunks.length

    appendUint32(chunks, 0x04034b50)
    appendUint16(chunks, 20)
    appendUint16(chunks, 0)
    appendUint16(chunks, 8)
    appendUint16(chunks, 0)
    appendUint16(chunks, 0)
    appendUint32(chunks, crc32(rawBytes))
    appendUint32(chunks, compressed.length)
    appendUint32(chunks, rawBytes.length)
    appendUint16(chunks, nameBytes.length)
    appendUint16(chunks, 0)
    chunks.push(...nameBytes)
    chunks.push(...compressed)

    appendUint32(centralDirectory, 0x02014b50)
    appendUint16(centralDirectory, 20)
    appendUint16(centralDirectory, 20)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 8)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint32(centralDirectory, crc32(rawBytes))
    appendUint32(centralDirectory, compressed.length)
    appendUint32(centralDirectory, rawBytes.length)
    appendUint16(centralDirectory, nameBytes.length)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint16(centralDirectory, 0)
    appendUint32(centralDirectory, 0)
    appendUint32(centralDirectory, localHeaderOffset)
    centralDirectory.push(...nameBytes)
  }

  const centralDirectoryOffset = chunks.length
  chunks.push(...centralDirectory)
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

describe('openZipArchive', () => {
  it('lists entries and reads the root SKILL.md text from a stored archive', async () => {
    const archive = await openZipArchive(storeBlob([
      { path: 'README.md', content: '# demo' },
      { path: 'SKILL.md', content: skillMdContent('demo-skill', 'A demo skill') },
    ]))

    expect(archive.entries.map((entry) => entry.path).sort()).toEqual(['README.md', 'SKILL.md'])
    const skillMdEntry = archive.entries.find((entry) => entry.path === 'SKILL.md')
    expect(skillMdEntry).toBeDefined()
    await expect(archive.readEntryText(skillMdEntry!)).resolves.toContain('name: demo-skill')
  })

  it('detects a nested-only SKILL.md path via entry listing', async () => {
    const archive = await openZipArchive(storeBlob([
      { path: 'docs/SKILL.md', content: skillMdContent('demo-skill', 'A demo skill') },
    ]))

    expect(archive.entries.some((entry) => entry.path === 'SKILL.md')).toBe(false)
    expect(archive.entries.map((entry) => entry.path)).toEqual(['docs/SKILL.md'])
  })

  it('inflates deflated entries', async () => {
    if (!hasDeflateSupport) {
      return
    }
    const archive = await openZipArchive(
      new Blob([(await buildDeflateZip([
        { path: 'SKILL.md', content: skillMdContent('deflated-skill', 'Compressed description') },
      ])) as BlobPart]),
    )

    const skillMdEntry = archive.entries.find((entry) => entry.path === 'SKILL.md')!
    expect(skillMdEntry.compressionMethod).toBe(8)
    await expect(archive.readEntryText(skillMdEntry)).resolves.toContain('Compressed description')
  })

  it('rejects non-zip payloads with a not-zip error', async () => {
    await expect(openZipArchive(new Blob([new TextEncoder().encode('plain text file')]))).rejects.toMatchObject({
      name: 'ZipReadError',
      reason: 'not-zip',
    } satisfies Partial<ZipReadError>)
  })

  it('rejects a corrupted central directory as corrupt', async () => {
    const full = buildStoreZip([{ path: 'SKILL.md', content: skillMdContent('demo', 'demo') }])
    const corrupt = full.slice()
    new DataView(corrupt.buffer).setUint32(corrupt.length - 22 + 12, 0xffffffff, true)
    await expect(openZipArchive(new Blob([corrupt as BlobPart]))).rejects.toMatchObject({
      name: 'ZipReadError',
      reason: 'corrupt',
    } satisfies Partial<ZipReadError>)
  })
})
