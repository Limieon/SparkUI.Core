import FS, { ReadStream } from 'fs'

import * as HashUtils from '$/utils/HashUtils'

export class File {
	protected constructor(stream: ReadStream) {
		this.handle = stream
	}

	async fromFile(file: string) {
		const handle = FS.createReadStream(file)
		return new File(handle)
	}

	protected async claculateHashes() {}

	private handle: ReadStream
	private sha1: string | undefined
	private sha256: string | undefined
	private md5: string | undefined
}

export class SDModelFile extends File {
	protected async claculateHashes() {
		await super.claculateHashes()
	}

	private modelHash: string | undefined
}
