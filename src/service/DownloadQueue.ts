import { db } from '../db/DB'
import { SDDownloadQueueItem, EDownloadStatus } from '../db/Schema'
import Axios from 'axios'
import { SPARKUI_CORE_CIVITAI_BASE, SPARKUI_CORE_DATA_DIR, SPARKUI_CORE_MAX_CONCURRENT_DOWNLOADS } from '../Env'
import { v4 } from 'uuid'
import Path from 'path'
import FS from 'fs'
import * as BlurHash from 'blurhash'
import { pipeline } from 'stream'
import { promisify } from 'util'

const streamPipeline = promisify(pipeline)

import * as CAI from '../types/CAI'
import Sharp from 'sharp'
import { getModelDir, logger, modelTypeFromString, SDModelType } from '../Utils'
import { sleep } from 'bun'
import { eq } from 'drizzle-orm'

interface DownloadQueueItem {
	id: string

	modelName: string
	remoteID: string
	downloadURL: string
	path: string
	thumbnail: Buffer
	thumbnailHash: string
	creatorID: string

	status: 'Pending' | 'Downloading' | 'Done' | 'Failed'
	progress: number
	sizeMB: number
	downloadStarted: number | null
}

const downloadQueuePath = Path.join(process.cwd(), SPARKUI_CORE_DATA_DIR, 'download-queue.json')

export let downloadQueue: DownloadQueueItem[] = []
let activveDownloads = 0

function createModelFilePath(downloadID: string, fileName: string, type: SDModelType) {
	return Path.join(
		process.cwd(),
		SPARKUI_CORE_DATA_DIR,
		'models',
		getModelDir(type),
		`${downloadID.split('-')[0]}-${fileName}`.replaceAll(/[\\\/ ]/g, '_')
	)
}

export async function wake() {
	if (!FS.existsSync(downloadQueuePath)) FS.writeFileSync(downloadQueuePath, '[]')
	downloadQueue = JSON.parse(FS.readFileSync(downloadQueuePath, { encoding: 'utf-8' }))
}

export async function queueCivitAIModel(creatorID: string, url: string) {
	const res = /.*?\/(\d+)[\/?](.*=(\d+))?/gm.exec(url)
	if (!res)
		return {
			data: undefined,
			error: 'Invalid URL',
		}

	let baseModelData: CAI.Model | undefined = undefined
	const modelID = res[1]
	const versionID = res[3]

	let models: CAI.ModelVersion[] = []
	if (versionID) {
		try {
			models = [(await Axios.get(`${SPARKUI_CORE_CIVITAI_BASE}/v1/model-versions/${versionID}`)).data]
			baseModelData = (await Axios.get(`${SPARKUI_CORE_CIVITAI_BASE}/v1/models/${modelID}`)).data
		} catch (e) {
			return {
				data: undefined,
				error: 'Invalid version ID',
			}
		}
	} else {
		try {
			const res = (await Axios.get(`${SPARKUI_CORE_CIVITAI_BASE}/v1/models/${modelID}`)).data
			models = res.modelVersions
			baseModelData = res
		} catch (e) {
			return {
				data: undefined,
				error: 'Invalid model ID',
			}
		}
	}

	if (!baseModelData)
		return {
			data: undefined,
			error: 'Invalid model ID',
		}

	const queueItems: DownloadQueueItem[] = []
	for (let m of models) {
		const { id: vID, name: vName, files } = m
		let file = files[0]

		const image = (await Axios.get(m.images[0].url, { responseType: 'arraybuffer' })).data
		const sharpInstance = Sharp(Buffer.from(image)).resize(256, 256)
		const thumbnail = await sharpInstance.webp({ quality: 70 }).toBuffer()
		const { data, info } = await sharpInstance.raw().toBuffer({ resolveWithObject: true })
		const blurHash = BlurHash.encode(new Uint8ClampedArray(data), info.width, info.height, 4, 4)

		for (let f of files) {
			if (f.metadata.size === 'pruned') file = f
			if (f.type === 'VAE') {
				const dID = v4()
				queueItems.push({
					id: dID,
					modelName: `${baseModelData.name} - ${vName} (VAE)`,
					remoteID: `${vID}`,
					downloadURL: f.downloadUrl,
					path: createModelFilePath(dID, f.name, SDModelType.VAE),
					thumbnail: thumbnail,
					thumbnailHash: blurHash,
					status: 'Pending',
					progress: 0,
					sizeMB: f.sizeKB / 1024,
					downloadStarted: null,
					creatorID,
				})
			}
		}

		const dID = v4()
		queueItems.push({
			id: dID,
			modelName: `${baseModelData.name} - ${vName}`,
			remoteID: `${vID}`,
			downloadURL: file.downloadUrl,
			path: createModelFilePath(dID, file.name, modelTypeFromString(baseModelData.type)),
			thumbnail: thumbnail,
			thumbnailHash: blurHash,
			status: 'Pending',
			progress: 0,
			sizeMB: file.sizeKB / 1024,
			downloadStarted: null,
			creatorID,
		})
	}

	for (let q of queueItems) await downloadItem(q)

	// Make the hibernation occur on shutdown
	await hibernate()

	processQueue()

	return {
		data: queueItems,
		error: undefined,
	}
}

async function downloadFile(downloadID: string) {
	const download = downloadQueue.find((d) => d.id === downloadID)
	if (!download) return

	const dirname = Path.dirname(download.path)
	if (!FS.existsSync(dirname)) FS.mkdirSync(dirname, { recursive: true })

	const writer = FS.createWriteStream(download.path)
	const response = await Axios.get(download.downloadURL, {
		responseType: 'stream',
	})

	logger.info(`Downloading ${download.modelName}...`)
	download.downloadStarted = Date.now()
	await onDownloadStarted(download)

	let downloadedSize = 0
	const updateProgress = new Promise<void>((resolve, reject) => {
		response.data.on('data', async (chunk) => {
			downloadedSize += chunk.length / 1024 / 1024
			download.progress = downloadedSize / download.sizeMB
			//logger.debug(`Downloaded ${download.progress * 100}% of ${download.modelName}`)
		})

		response.data.on('end', () => resolve())
		response.data.on('error', async (err: Error) => {
			await onDownloadFinished(download)
			reject(err)
		})
	})

	await streamPipeline(response.data, writer)
	await updateProgress
	await onDownloadFinished(download)

	logger.info(`Downloaded ${download.modelName}`)

	writer.close()
}

async function downloadItem(data: DownloadQueueItem) {
	downloadQueue.push(data)
	await db.insert(SDDownloadQueueItem).values({
		id: data.id,
		modelName: data.modelName,
		remoteID: data.remoteID,
		downloadURL: data.downloadURL,
		path: data.path,
		thumbnail: data.thumbnail,
		thumbnailHash: data.thumbnailHash,
		status: 'Pending',
		progress: 0,
		sizeMB: data.sizeMB,
		creatorID: data.creatorID,
	})

	processQueue()
}

export async function processQueue() {
	logger.debug(`Processing download queue, active downloads: ${activveDownloads}/${SPARKUI_CORE_MAX_CONCURRENT_DOWNLOADS}`)

	if (activveDownloads >= SPARKUI_CORE_MAX_CONCURRENT_DOWNLOADS) return

	const nextDownload = downloadQueue.find((d) => d.status === 'Pending')
	if (!nextDownload) return

	activveDownloads++
	nextDownload.status = 'Downloading'
	nextDownload.progress = 0
	try {
		await downloadFile(nextDownload.id)
		nextDownload.status = 'Done'
	} catch (e) {
		nextDownload.status = 'Failed'
		logger.error(`Failed to download ${nextDownload.modelName}, URL: ${nextDownload.downloadURL}, Path: ${nextDownload.path}`, e)
	}
	activveDownloads--

	processQueue()
}

export async function hibernate() {
	FS.writeFileSync(downloadQueuePath, JSON.stringify(downloadQueue, null, 4))
}

async function onDownloadProgress(item: DownloadQueueItem) {
	await db.update(SDDownloadQueueItem).set({ progress: item.progress }).where(eq(SDDownloadQueueItem.id, item.id))
}
async function onDownloadStarted(item: DownloadQueueItem) {
	await db.update(SDDownloadQueueItem).set({ status: 'Downloading' }).where(eq(SDDownloadQueueItem.id, item.id))
}
async function onDownloadFinished(item: DownloadQueueItem) {
	await db.update(SDDownloadQueueItem).set({ progress: 1, status: 'Done' }).where(eq(SDDownloadQueueItem.id, item.id))
}
async function onDownloadFailed(item: DownloadQueueItem) {
	await db.update(SDDownloadQueueItem).set({ progress: 0, status: 'Failed' }).where(eq(SDDownloadQueueItem.id, item.id))
}
