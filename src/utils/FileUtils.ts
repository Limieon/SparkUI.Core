import FS, { ReadStream } from 'fs'

import * as HashUtils from '$/utils/HashUtils'

import Util from 'util'
import { EModelPrecision } from './TypeUtils'

type STHeader = any

export namespace SafeTensors {
	export async function getHeader(file: string): Promise<STHeader> {
		const fileDescriptor = await Util.promisify(FS.open)(file, 'r')

		try {
			const headerLengthBuffer = Buffer.alloc(8)
			await Util.promisify(FS.read)(fileDescriptor, headerLengthBuffer, 0, 8, 0)

			const headerLength = headerLengthBuffer.readBigUInt64LE()

			const headerBuffer = Buffer.alloc(Number(headerLength))
			await Util.promisify(FS.read)(fileDescriptor, headerBuffer, 0, headerBuffer.length, 8)

			return JSON.parse(headerBuffer.toString('utf-8')) // return the header as a Buffer
		} catch (error) {
			console.error('Error reading the SafeTensors file header:', error)
			throw error
		} finally {
			await Util.promisify(FS.close)(fileDescriptor)
		}
	}

	export function getDType(header: STHeader): EModelPrecision {
		for (let k of Object.keys(header)) {
			const value = header[k]
			if (value.dtype) {
				switch (value.dtype.toLowerCase()) {
					case 'bf16':
						return 'BF16'
					case 'fp16':
						return 'FP16'
					case 'fp32':
						return 'FP32'
				}
			}
		}

		return 'Unknown'
	}
}
