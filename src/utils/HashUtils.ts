import FS, { ReadStream } from 'fs'
import crypto, { Hash } from 'crypto'

import Logger from '@log'
import { FileHandle } from 'fs/promises'

interface SDHashPair {
	sha256: string
	sha1: string
	md5: string
	modelHash: string
}

export async function getSDModelHash(filePath: string): Promise<string> {
	Logger.debug('Calculating model hash for file:', filePath)
	return new Promise((resolve, reject) => {
		const stream = FS.createReadStream(filePath, { start: 0, end: 7 })

		let uint64Buffer: Buffer = Buffer.alloc(8)
		stream.on('data', (chunk: Buffer) => {
			chunk.copy(uint64Buffer, 0)
		})

		stream.on('end', () => {
			const skipBytes = uint64Buffer.readBigUInt64LE(0)
			const remainingStream = FS.createReadStream(filePath, { start: 8 + Number(skipBytes) })
			const hash = crypto.createHash('sha256')

			remainingStream.on('data', (chunk) => {
				hash.update(chunk)
			})

			remainingStream.on('end', () => {
				resolve(hash.digest('hex'))
			})

			remainingStream.on('error', (err) => {
				reject(err)
			})
		})

		stream.on('error', (err) => {
			Logger.error('Error reading file:', err)
			reject(err)
		})
	})
}

export async function getSDHashes(filePath: string): Promise<SDHashPair> {
	Logger.debug('Calculating hashes for file:', filePath)
	const start = Date.now()

	const hashTypes = ['sha256', 'sha1', 'md5']
	const readStream = FS.createReadStream(filePath)
	const hashers = hashTypes.map((hashType) => crypto.createHash(hashType))
	const modelHashPromise = getSDModelHash(filePath)

	return new Promise((resolve, reject) => {
		readStream.on('data', (chunk) => {
			hashers.forEach((hasher) => {
				hasher.update(chunk)
			})
		})

		readStream.on('end', async () => {
			const hashResults = await Promise.all(hashers.map((hasher) => hasher.digest('hex')))
			const [sha256, sha1, md5] = hashResults

			const modelHash = await modelHashPromise

			Logger.debug('Hashes calculated in', Date.now() - start, 'ms')
			resolve({ sha256, sha1, md5, modelHash })
		})
		readStream.on('error', (err) => {
			Logger.error('Error reading file:', err)
			reject(err)
		})
	})
}
