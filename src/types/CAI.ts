export interface Model {
	id: number
	name: string
	description: string
	allowNoCredit: boolean
	allowCommercialUse: string[]
	allowDerivatives: boolean
	allowDifferentLicense: boolean
	type: string
	minor: boolean
	poi: boolean
	nsfw: boolean
	nsfwLevel: number
	cosmetic: any
	stats: Stats
	creator: Creator
	tags: string[]
	modelVersions: ModelVersion[]
}

export interface Stats {
	downloadCount: number
	favoriteCount: number
	thumbsUpCount: number
	thumbsDownCount: number
	commentCount: number
	ratingCount: number
	rating: number
	tippedAmountCount: number
}

export interface Creator {
	username: string
	image: string
}

export interface ModelVersion {
	id: number
	index: number
	name: string
	baseModel: string
	baseModelType: string
	createdAt: string
	publishedAt: string
	status: string
	availability: string
	nsfwLevel: number
	stats: VersionStats
	files: File[]
	images: Image[]
	downloadUrl: string
	description?: string
}

export interface VersionStats {
	downloadCount: number
	ratingCount: number
	rating: number
	thumbsUpCount: number
	thumbsDownCount: number
}

export interface File {
	id: number
	sizeKB: number
	name: string
	type: string
	pickleScanResult: string
	pickleScanMessage: string
	virusScanResult: string
	virusScanMessage: any
	scannedAt: string
	metadata: Metadata
	hashes: Hashes
	downloadUrl: string
	primary?: boolean
}

export interface Metadata {
	format: string
	size?: string
	fp?: string
}

export interface Hashes {
	AutoV1: string
	AutoV2: string
	SHA256: string
	CRC32: string
	BLAKE3: string
	AutoV3?: string
}

export interface Image {
	url: string
	nsfwLevel: number
	width: number
	height: number
	hash: string
	type: string
	hasMeta: boolean
	onSite: boolean
}
