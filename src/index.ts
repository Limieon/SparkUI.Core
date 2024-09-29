import Server, { initRoutes } from './Server'
import Path from 'path'
import { logger } from './Utils'

import * as DownloadQueue from './service/DownloadQueue'
;['SIGINT', 'SIGTERM'].forEach((signal) => {
	process.on(signal, shutdown)
})

async function main() {
	DownloadQueue.wake()

	initRoutes(Path.join(process.cwd(), 'src', 'api'))
}
async function shutdown() {
	logger.info('Shutting down...')

	await DownloadQueue.hibernate()
}

main()
	.then()
	.catch((err) => {
		logger.error('Error in main', err)
		process.exit(1)
	})
