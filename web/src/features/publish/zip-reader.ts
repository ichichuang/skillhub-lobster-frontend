export type ZipReadFailureReason = 'not-zip' | 'corrupt' | 'unsupported'

export class ZipReadError extends Error {
  constructor(
    public readonly reason: ZipReadFailureReason,
    message?: string,
  ) {
    super(message ?? reason)
    this.name = 'ZipReadError'
  }
}

export interface ZipEntry {
  path: string
  isDirectory: boolean
  compressionMethod: number
  compressedSize: number
  uncompressedSize: number
  encrypted: boolean
  localHeaderOffset: number
}

export interface OpenedZipArchive {
  entries: ZipEntry[]
  readEntryText: (entry: ZipEntry) => Promise<string>
}

const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const LOCAL_HEADER_SIGNATURE = 0x04034b50
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50
const EOCD_MIN_LENGTH = 22
const ZIP64_EOCD_LOCATOR_LENGTH = 20
const ZIP_COMMENT_MAX_LENGTH = 0xffff
const METHOD_STORED = 0
const METHOD_DEFLATED = 8
const FLAG_ENCRYPTED = 0x1

const decoder = new TextDecoder()

async function readSlice(file: Blob, start: number, end: number): Promise<Uint8Array> {
  const buffer = await file.slice(start, end).arrayBuffer()
  return new Uint8Array(buffer)
}

async function inflateRawBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new ZipReadError('unsupported', 'DecompressionStream is unavailable in this browser')
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

function findEndOfCentralDirectory(tail: Uint8Array): number {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength)
  for (let index = tail.byteLength - EOCD_MIN_LENGTH; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === EOCD_SIGNATURE) {
      return index
    }
  }
  return -1
}

function parseCentralDirectory(centralDirectory: Uint8Array, totalEntries: number): ZipEntry[] {
  const view = new DataView(centralDirectory.buffer, centralDirectory.byteOffset, centralDirectory.byteLength)
  const entries: ZipEntry[] = []
  let offset = 0

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > centralDirectory.byteLength || view.getUint32(offset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new ZipReadError('corrupt', 'Invalid central directory entry')
    }

    const flags = view.getUint16(offset + 8, true)
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const path = decoder.decode(centralDirectory.subarray(offset + 46, offset + 46 + nameLength))
    const nameStart = path.lastIndexOf('/')
    const fileName = nameStart >= 0 ? path.slice(nameStart + 1) : path

    entries.push({
      path,
      // Windows archive tools emit directory entries ending in a backslash;
      // the server extractor skips those exactly like trailing-slash entries.
      isDirectory: path.endsWith('/') || path.endsWith('\\') || fileName === '' || fileName === '.',
      compressionMethod,
      compressedSize,
      uncompressedSize,
      encrypted: (flags & FLAG_ENCRYPTED) !== 0,
      localHeaderOffset,
    })

    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

export async function openZipArchive(file: Blob): Promise<OpenedZipArchive> {
  if (file.size < EOCD_MIN_LENGTH) {
    throw new ZipReadError('not-zip')
  }

  const tailLength = Math.min(file.size, EOCD_MIN_LENGTH + ZIP_COMMENT_MAX_LENGTH)
  const tail = await readSlice(file, file.size - tailLength, file.size)
  const eocdOffsetInTail = findEndOfCentralDirectory(tail)
  if (eocdOffsetInTail < 0) {
    throw new ZipReadError('not-zip')
  }

  const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength)
  if (
    eocdOffsetInTail >= ZIP64_EOCD_LOCATOR_LENGTH
    && tailView.getUint32(eocdOffsetInTail - ZIP64_EOCD_LOCATOR_LENGTH, true) === ZIP64_EOCD_LOCATOR_SIGNATURE
  ) {
    throw new ZipReadError('unsupported', 'ZIP64 archives are not supported for local preview')
  }

  const totalEntries = tailView.getUint16(eocdOffsetInTail + 10, true)
  const centralDirectorySize = tailView.getUint32(eocdOffsetInTail + 12, true)
  const centralDirectoryOffset = tailView.getUint32(eocdOffsetInTail + 16, true)
  if (centralDirectoryOffset + centralDirectorySize > file.size) {
    throw new ZipReadError('corrupt', 'Central directory is out of bounds')
  }

  const centralDirectory = await readSlice(file, centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize)
  const entries = parseCentralDirectory(centralDirectory, totalEntries)

  const readEntryText = async (entry: ZipEntry): Promise<string> => {
    if (entry.isDirectory) {
      return ''
    }
    if (entry.encrypted || (entry.compressionMethod !== METHOD_STORED && entry.compressionMethod !== METHOD_DEFLATED)) {
      throw new ZipReadError('unsupported', `Unsupported entry: ${entry.path}`)
    }

    if (entry.localHeaderOffset + 30 > file.size) {
      throw new ZipReadError('corrupt', 'Local header is out of bounds')
    }
    const localHeader = await readSlice(file, entry.localHeaderOffset, entry.localHeaderOffset + 30)
    const localView = new DataView(localHeader.buffer, localHeader.byteOffset, localHeader.byteLength)
    if (localView.getUint32(0, true) !== LOCAL_HEADER_SIGNATURE) {
      throw new ZipReadError('corrupt', 'Invalid local header signature')
    }
    const localNameLength = localView.getUint16(26, true)
    const localExtraLength = localView.getUint16(28, true)
    const dataStart = entry.localHeaderOffset + 30 + localNameLength + localExtraLength
    if (dataStart + entry.compressedSize > file.size) {
      throw new ZipReadError('corrupt', 'Entry data is out of bounds')
    }

    const data = await readSlice(file, dataStart, dataStart + entry.compressedSize)
    const bytes = entry.compressionMethod === METHOD_DEFLATED
      ? await inflateRawBytes(data)
      : data
    return decoder.decode(bytes)
  }

  return { entries, readEntryText }
}
