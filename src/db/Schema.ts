import { relations, sql } from 'drizzle-orm'

import {
	uuid,
	text,
	smallint as int16,
	integer as int32,
	bigint as int64,
	doublePrecision as float64,
	jsonb as json,
	varchar,
	timestamp,
	numeric,
	boolean,
	customType,
	pgTable,
	pgEnum,
} from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
	dataType() {
		return 'bytea'
	},
})

const id = uuid('id').defaultRandom().primaryKey()
const createdAt = timestamp('created_at').defaultNow()
const updatedAt = timestamp('updated_at').defaultNow()

export const ESDItemType = pgEnum('ESDItemType', [
	'Checkpoint',
	'Lora',
	'Embedding',
	'ControlNet',
	'ControlNetPreProcessor',
	'VAE',
	'Other',
])
export const EModelFileFormat = pgEnum('EFileFormat', ['SafeTensors', 'PickleTensor', 'ONNX', 'Other'])
export const EModelPrecision = pgEnum('EPrecision', ['FP32', 'FP16', 'BF16'])
export const EModelSizeType = pgEnum('ESizeType', ['Pruned', 'Full', 'Unknown'])
export const EGenerationStatus = pgEnum('EGenerationStatus', ['Pending', 'Running', 'Succeded', 'Failed'])
export const EControlNetType = pgEnum('EControlNetType', [
	'Blur',
	'Canny',
	'Depth',
	'IPAdapter',
	'Inpaint',
	'InstantID',
	'Lineart',
	'MLSD',
	'NormalMap',
	'OpenPose',
	'Recolor',
	'Reference',
	'Revision',
	'Scribble',
	'Segmentation',
	'Shuffle',
	'Sketch',
	'SoftEdge',
	'T2IAdapter',
	'Tile',
])
export const EControlNetMode = pgEnum('EControlNetMode', ['Balanced', 'Prompt', 'ControlNet'])
export const EControlNetResizeMode = pgEnum('EControlNetResizeMode', ['Resize', 'CropAndResize', 'ResizeAndFill'])
export const ESDTrainingType = pgEnum('ESDTrainingType', ['CheckpointTrained', 'CheckpointMered', 'Unknown'])
export const EDownloadStatus = pgEnum('EDownloadStatus', ['Pending', 'Downloading', 'Done', 'Failed'])

export const Image = pgTable('Image', {
	id,
	createdAt,
	data: bytea('data'),
	url: varchar('file', { length: 256 }),
	blurHash: varchar('blur_hash', { length: 128 }),

	creatorId: uuid('creator_id')
		.references(() => User.id, { onDelete: 'set null' })
		.notNull(),
	baseItemId: uuid('base_item_id').references(() => SDBaseItem.id, {
		onDelete: 'set null',
	}),
})

export const ImageRelations = relations(Image, ({ one, many }) => ({
	creator: one(User, {
		fields: [Image.creatorId],
		references: [User.id],
	}),
	baseItem: one(SDBaseItem, {
		fields: [Image.baseItemId],
		references: [SDBaseItem.id],
	}),
	generationBatchItem: one(SDGenerationBatchItem, {
		fields: [Image.id],
		references: [SDGenerationBatchItem.imageId],
	}),

	datasetItems: many(SDDatasetItem),
	tags: many(JTagImage),
}))

export const Tag = pgTable('Tag', {
	name: varchar('name', { length: 64 }).primaryKey(),
	color: int32('color').default(0),

	creatorId: uuid('creator_id')
		.references(() => User.id)
		.notNull(),

	createdAt,
})
export const TagRelations = relations(Tag, ({ one, many }) => ({
	creator: one(User, {
		fields: [Tag.creatorId],
		references: [User.id],
	}),
	baseItems: many(JTagSDBaseItem),
	datasets: many(JTagSDDataset),
	images: many(JTagImage),
}))

export const User = pgTable('User', {
	id,

	email: varchar('email', { length: 64 }).unique().notNull(),
	name: varchar('username', { length: 64 }).unique().notNull(),
	avatar: bytea('avatar'),
	password: varchar('password', { length: 256 }).notNull(),
	roleId: uuid('role_id').references(() => UserRole.id),
	refreshToken: varchar('refresh_token', { length: 512 }),

	createdAt,
	updatedAt,
})

export const UserRelations = relations(User, ({ one, many }) => ({
	roles: one(UserRole, {
		fields: [User.roleId],
		references: [UserRole.id],
	}),

	tags: many(Tag),
	images: many(Image),
	datasets: many(SDDataset),
	generationBatches: many(SDGenerationBatch),
	containers: many(SDContainer),
	sdBaseItems: many(SDBaseItem),
	modelFiles: many(SDModelFile),
	downloadQueueItems: many(SDDownloadQueueItem),
}))

export const UserRole = pgTable('UserRole', {
	id,

	name: varchar('name', { length: 64 }).unique().notNull(),
	color: int32('color').default(0),

	premissions: json('premissions').default({}),

	createdAt,
	updatedAt,
})
export const UserRoleRelations = relations(UserRole, ({ many }) => ({
	users: many(User),
}))

// A generation node is a stateless service that can generate images
// The important thing is that generation nodes cant store any data and are stateless
export const SDNode = pgTable('SDNode', {
	id,

	host: varchar('host', { length: 256 }),
	port: int16('port'),
	authenticationKey: uuid('authentication_key').defaultRandom(),

	// Node meta
	cpu: varchar('cpu', { length: 256 }),
	gpu: varchar('gpu', { length: 256 }),
	totalVram: int32('total_vram'),
	totalRam: int32('total_ram'),
	cacheSize: int32('cache_size'),
})

// Misc data that are not directly related stable diffusion but are used by the service
export const SDDownloadQueueItem = pgTable('SDDownloadQueueItem', {
	id,

	modelName: varchar('model_name', { length: 256 }).notNull(),
	downloadURL: varchar('download_url', { length: 256 }).notNull(),
	path: varchar('path', { length: 256 }).notNull(),
	progress: float64('progress').notNull().default(0),
	sizeMB: float64('size_mb').notNull(),
	thumbnail: bytea('thumbnail').notNull(),
	thumbnailHash: varchar('thumbnail_hash', { length: 128 }).notNull(),

	status: EDownloadStatus('status').notNull().default('Pending'),

	remoteID: varchar('remote_id', { length: 256 }).notNull(),
	creatorID: uuid('creator_id')
		.references(() => User.id)
		.notNull(),
})
export const SDDownloadQueueRelations = relations(SDDownloadQueueItem, ({ one }) => ({
	creator: one(User, {
		fields: [SDDownloadQueueItem.creatorID],
		references: [User.id],
	}),
}))

export const SDContainer = pgTable('SDContainer', {
	id,

	name: varchar('name', { length: 256 }),
	description: text('description'),
	brief: varchar('brief', { length: 256 }),

	creatorId: uuid('creator_id')
		.references(() => User.id)
		.notNull(),

	createdAt,
	updatedAt,
})
export const SDContainerRelations = relations(SDContainer, ({ one, many }) => ({
	creator: one(User, {
		fields: [SDContainer.creatorId],
		references: [User.id],
	}),
	items: many(SDBaseItem),
}))

export const SDBaseItem = pgTable('SDBaseItem', {
	id,

	type: ESDItemType('type').notNull(),
	name: varchar('name', { length: 256 }).notNull(),
	description: text('description').notNull().default(''),
	brief: varchar('brief', { length: 256 }).notNull().default(''),
	version: varchar('version', { length: 64 }).notNull().default(''),
	usedInBatches: int32('used_in_batches').notNull().default(0),
	usedInImages: int32('used_in_images').notNull().default(0),
	nsfw: boolean('nsfw').notNull(),
	nsfwLevel: int32('nsfw_level').notNull(),
	trainingType: ESDTrainingType('training_type').notNull().default('Unknown'),

	// Foreign keys
	containerId: uuid('container_id').references(() => SDContainer.id),
	creatorId: uuid('creator_id')
		.references(() => User.id)
		.notNull(),

	createdAt,
	updatedAt,
	lastUsedAt: timestamp('last_used_at'),
})
export const SDBaseItemRelations = relations(SDBaseItem, ({ one, many }) => ({
	container: one(SDContainer, {
		fields: [SDBaseItem.containerId],
		references: [SDContainer.id],
	}),
	creator: one(User, {
		fields: [SDBaseItem.creatorId],
		references: [User.id],
	}),

	files: many(SDModelFile),
	tags: many(JTagSDBaseItem),
	trainingInfo_merged_out: many(SDTrainingInfo_Merged, {
		relationName: 'outputItem',
	}),
	trainingInfo_merged_in: many(SDTrainingInfo_Merged, {
		relationName: 'inputItem',
	}),
	trainingInfo_trained: many(SDTrainingInfo_Trained),
	images: many(Image),
}))

export const SDTrainingInfo_Trained = pgTable('SDTrainingInfo_Trained', {
	id: uuid('id').defaultRandom().primaryKey(),

	itemId: uuid('item_id').references(() => SDBaseItem.id),
	datasetId: uuid('dataset_id').references(() => SDDataset.id),

	hyperparameters: json('hyperparameters').default({}),
})
export const SDTrainingInfo_TrainedRelations = relations(SDTrainingInfo_Trained, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDTrainingInfo_Trained.itemId],
		references: [SDBaseItem.id],
	}),
	dataset: one(SDDataset, {
		fields: [SDTrainingInfo_Trained.datasetId],
		references: [SDDataset.id],
	}),
}))

export const SDTrainingInfo_Merged = pgTable('SDTrainingInfo_Merged', {
	id: uuid('id').defaultRandom().primaryKey(),

	// The item id of the merged item
	outId: uuid('resulted_item_id')
		.references(() => SDBaseItem.id)
		.notNull(),

	// The id of the item that was merged into the result
	inId: uuid('merged_id')
		.references(() => SDBaseItem.id)
		.notNull(),

	weight: float64('weight').notNull(),
	hyperparameters: json('hyperparameters').default({}),
})
export const SDTrainingInfo_MergedRelations = relations(SDTrainingInfo_Merged, ({ one, many }) => ({
	outputItem: one(SDBaseItem, {
		relationName: 'outputItem',
		fields: [SDTrainingInfo_Merged.outId],
		references: [SDBaseItem.id],
	}),
	inputItem: one(SDBaseItem, {
		relationName: 'inputItem',
		fields: [SDTrainingInfo_Merged.inId],
		references: [SDBaseItem.id],
	}),
}))

export const SDCheckpointItem = pgTable('SDCheckpointItem', {
	id: uuid('id')
		.references(() => SDBaseItem.id)
		.primaryKey(),

	refiner: boolean('refiner').default(false),
})
export const SDCheckpointItemRelations = relations(SDCheckpointItem, ({ one, many }) => ({
	item: one(SDBaseItem, {
		fields: [SDCheckpointItem.id],
		references: [SDBaseItem.id],
	}),
	generationBatches_checkpoint: many(SDGenerationBatch, {
		relationName: 'usedCheckpoint',
	}),
	generationBatches_refiner: many(SDGenerationBatch, {
		relationName: 'usedRefiner',
	}),
}))

export const SDLoraItem = pgTable('SDLoraItem', {
	id: uuid('id')
		.references(() => SDBaseItem.id)
		.primaryKey(),
	triggerWords: varchar('trigger_words', { length: 256 }).default(''),
})
export const SDLoraItemRelations = relations(SDLoraItem, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDLoraItem.id],
		references: [SDBaseItem.id],
	}),
}))

export const SDEmbeddingItem = pgTable('SDEmbeddingItem', {
	id: uuid('id')
		.references(() => SDBaseItem.id)
		.primaryKey(),
	triggerWords: varchar('trigger_words', { length: 256 }).default(''),
})
export const SDEmbeddingItemRelations = relations(SDEmbeddingItem, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDEmbeddingItem.id],
		references: [SDBaseItem.id],
	}),
}))

export const SDVAEItem = pgTable('SDVAEItem', {
	id: uuid('id')
		.references(() => SDBaseItem.id)
		.primaryKey(),
})
export const SDVAEItemRelations = relations(SDVAEItem, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDVAEItem.id],
		references: [SDBaseItem.id],
	}),
}))

export const SDControlNetItem = pgTable('SDControlNetItem', {
	id,

	itemId: uuid('item_id').references(() => SDBaseItem.id),
})
export const SDControlNetItemRelations = relations(SDControlNetItem, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDControlNetItem.itemId],
		references: [SDBaseItem.id],
	}),
}))

export const SDControlNetPreProcessorItem = pgTable('SDControlNetPreProcessorItem', {
	id,

	itemId: uuid('item_id').references(() => SDBaseItem.id),
})
export const SDControlNetPreProcessorItemRelations = relations(SDControlNetPreProcessorItem, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDControlNetPreProcessorItem.itemId],
		references: [SDBaseItem.id],
	}),
}))

export const SDModelFile = pgTable('SDModelFile', {
	id,

	location: varchar('location', { length: 256 }),
	format: EModelFileFormat('format'),
	precision: EModelPrecision('precision'),
	sizeType: EModelSizeType('size_type'),
	sha1: varchar('sha1', { length: 40 }),
	sha256: varchar('sha256', { length: 64 }),
	modelHash: varchar('model_hash', { length: 16 }),
	sizeMB: float64('size').notNull(),

	// Foreign keys
	itemId: uuid('item_id').references(() => SDBaseItem.id),
	uploaderId: uuid('uploader_id').references(() => User.id),

	createdAt,
})
export const SDModelFileRelations = relations(SDModelFile, ({ one }) => ({
	item: one(SDBaseItem, {
		fields: [SDModelFile.itemId],
		references: [SDBaseItem.id],
	}),
	uploader: one(User, {
		fields: [SDModelFile.uploaderId],
		references: [User.id],
	}),
}))

export const SDGenerationBatch = pgTable('SDGenerationBatch', {
	id,

	// Generation Data
	inputImageId: uuid('input_image_id').references(() => Image.id),
	prompt: text('prompt'),
	negativePrompt: text('negative_prompt'),
	sampler: varchar('sampler', { length: 64 }),
	cfgScale: float64('cfg_scale'),
	steps: int32('steps'),
	seed: int64('seed', { mode: 'bigint' }),

	customData: json('custom_data'),

	// Generation Meta
	generationStatus: EGenerationStatus('generation_status'),

	// Foreign keys
	usedCheckpointId: uuid('used_checkpoint_id').references(() => SDCheckpointItem.id),
	usedRefinerId: uuid('used_refiner_id').references(() => SDCheckpointItem.id),
	creatorId: uuid('creator_id')
		.references(() => User.id)
		.notNull(),

	createdAt,
	updatedAt,
	startedAt: timestamp('started_at'),
	finishedAt: timestamp('finished_at'),
})
export const SDGenerationBatchRelations = relations(SDGenerationBatch, ({ one, many }) => ({
	usedCheckpoint: one(SDCheckpointItem, {
		relationName: 'usedCheckpoint',
		fields: [SDGenerationBatch.usedCheckpointId],
		references: [SDCheckpointItem.id],
	}),
	usedRefiner: one(SDCheckpointItem, {
		relationName: 'usedRefiner',
		fields: [SDGenerationBatch.usedRefinerId],
		references: [SDCheckpointItem.id],
	}),
	inputImage: one(Image, {
		fields: [SDGenerationBatch.inputImageId],
		references: [Image.id],
	}),
	creator: one(User, {
		fields: [SDGenerationBatch.creatorId],
		references: [User.id],
	}),

	items: many(SDGenerationBatchItem),
	usedItems: many(JSDGenerationBatchSDBaseItem),
}))

export const SDGenerationBatchItem = pgTable('SDGenerationBatchItem', {
	id,

	subseed: int64('subseed', { mode: 'bigint' }),
	rating: int16('rating'),

	customData: json('custom_data'),

	// Foreign keys
	batchId: uuid('batch_id').references(() => SDGenerationBatch.id),
	imageId: uuid('image_id').references(() => Image.id),
})
export const SDGenerationBatchItemRelations = relations(SDGenerationBatchItem, ({ one }) => ({
	batch: one(SDGenerationBatch, {
		fields: [SDGenerationBatchItem.batchId],
		references: [SDGenerationBatch.id],
	}),
	image: one(Image, {
		fields: [SDGenerationBatchItem.imageId],
		references: [Image.id],
	}),
}))

export const SDGenerationBatchItemAnalysis = pgTable('SDGenerationBatchItemAnalysis', {
	id,
	imageId: uuid('image_id').references(() => SDGenerationBatchItem.id),
	model: varchar('model', { length: 256 }).notNull(), // Stores the Ollama tag, might be a foregin key to a model table in the future
	quantization: varchar('quantization', { length: 64 }).notNull(),
	prompt: text('prompt').notNull(),
	systemPrompt: text('system_prompt'),
	analysisText: text('analysis_text'),
	analysisData: json('analysis_data'),

	analyzedAt: timestamp('analyzed_at').defaultNow(),
})
export const SDGenerationBatchItemAnalysisRelations = relations(SDGenerationBatchItemAnalysis, ({ one }) => ({
	image: one(SDGenerationBatchItem, {
		fields: [SDGenerationBatchItemAnalysis.imageId],
		references: [SDGenerationBatchItem.id],
	}),
}))

export const SDDataset = pgTable('SDDataset', {
	id,

	name: varchar('name', { length: 256 }),
	description: text('description'),
	brief: varchar('brief', { length: 256 }),

	creatorId: uuid('creator_id')
		.references(() => User.id)
		.notNull(),

	createdAt,
	updatedAt,
})
export const SDDatasetRelations = relations(SDDataset, ({ one, many }) => ({
	creator: one(User, {
		fields: [SDDataset.creatorId],
		references: [User.id],
	}),

	items: many(SDDatasetItem),
	usedForItems: many(SDTrainingInfo_Trained),
	tags: many(JTagSDDataset),
}))

export const SDDatasetItem = pgTable('SDDatasetItem', {
	id,

	caption: text('caption'),

	// Foreign keys
	datasetId: uuid('dataset_id').references(() => SDDataset.id),
	imageId: uuid('image_id').references(() => Image.id),
})
export const SDatasetItemRelations = relations(SDDatasetItem, ({ one, many }) => ({
	image: one(Image, {
		fields: [SDDatasetItem.imageId],
		references: [Image.id],
	}),
	dataset: one(SDDataset, {
		fields: [SDDatasetItem.datasetId],
		references: [SDDataset.id],
	}),
}))

// Junction Tables
export const JTagImage = pgTable('JTagImage', {
	tagName: varchar('tag_name', { length: 64 })
		.notNull()
		.references(() => Tag.name),
	imageId: uuid('image_id')
		.notNull()
		.references(() => Image.id),
})
export const JTagImageRelations = relations(JTagImage, ({ one }) => ({
	tag: one(Tag, {
		fields: [JTagImage.tagName],
		references: [Tag.name],
	}),
	image: one(Image, {
		fields: [JTagImage.imageId],
		references: [Image.id],
	}),
}))

// ---> Generation Batch related junction tables <---
export const JSDGenerationBatchSDBaseItem = pgTable('JSDGenerationBatchSDBaseItem', {
	weight: float64('weight').notNull(),

	batchId: uuid('batch_id')
		.notNull()
		.references(() => SDGenerationBatch.id),
	baseItemId: uuid('base_item_id')
		.notNull()
		.references(() => SDBaseItem.id),
})
export const JSDGenerationBatchSDBaseItemRelations = relations(JSDGenerationBatchSDBaseItem, ({ one }) => ({
	batch: one(SDGenerationBatch, {
		fields: [JSDGenerationBatchSDBaseItem.batchId],
		references: [SDGenerationBatch.id],
	}),
	baseItem: one(SDBaseItem, {
		fields: [JSDGenerationBatchSDBaseItem.baseItemId],
		references: [SDBaseItem.id],
	}),
}))

export const JSDGenerationBatchControlNetItem = pgTable('JSDGenerationBatchControlNet', {
	type: EControlNetType('type').notNull(),
	pixelPerfect: boolean('pixel_perfect').notNull(),

	// Preprocessor Meta
	preprocessorId: uuid('preprocessor_id').references(() => SDControlNetPreProcessorItem.id),
	preImageId: uuid('pre_image_id').references(() => Image.id),

	inputImageId: uuid('input_image_id').references(() => Image.id),

	// Optional Mask
	mask: bytea('mask'),

	// ControlNet Meta
	mode: EControlNetMode('mode').notNull(),
	resizeMode: EControlNetResizeMode('resize_mode').notNull(),
	resolution: int32('resolution').notNull(), // Only available if pixel perfect is false

	batchId: uuid('batch_id')
		.notNull()
		.references(() => SDGenerationBatch.id),
	controlNetItemId: uuid('control_net_item_id')
		.notNull()
		.references(() => SDControlNetItem.id),
})
export const JSDGenerationBatchControlNetItemRelations = relations(JSDGenerationBatchControlNetItem, ({ one }) => ({
	batch: one(SDGenerationBatch, {
		fields: [JSDGenerationBatchControlNetItem.batchId],
		references: [SDGenerationBatch.id],
	}),
	controlNetItem: one(SDControlNetItem, {
		fields: [JSDGenerationBatchControlNetItem.controlNetItemId],
		references: [SDControlNetItem.id],
	}),
	preprocessor: one(SDControlNetPreProcessorItem, {
		fields: [JSDGenerationBatchControlNetItem.preprocessorId],
		references: [SDControlNetPreProcessorItem.id],
	}),
	preImage: one(Image, {
		fields: [JSDGenerationBatchControlNetItem.preImageId],
		references: [Image.id],
	}),
	inputImage: one(Image, {
		fields: [JSDGenerationBatchControlNetItem.inputImageId],
		references: [Image.id],
	}),
}))

// ---> Tag related junction tables <---
export const JTagSDBaseItem = pgTable('JTagSDBaseItem', {
	tagName: varchar('tag_name', { length: 64 })
		.notNull()
		.references(() => Tag.name),
	baseItemId: uuid('base_item_id')
		.notNull()
		.references(() => SDBaseItem.id),
})
export const JTagSDBaseItemRelations = relations(JTagSDBaseItem, ({ one }) => ({
	tag: one(Tag, {
		fields: [JTagSDBaseItem.tagName],
		references: [Tag.name],
	}),
	baseItem: one(SDBaseItem, {
		fields: [JTagSDBaseItem.baseItemId],
		references: [SDBaseItem.id],
	}),
}))

export const JTagSDDataset = pgTable('JTagSDDataset', {
	tagName: varchar('tag_name', { length: 64 })
		.notNull()
		.references(() => Tag.name),
	datasetId: uuid('dataset_id')
		.notNull()
		.references(() => SDDataset.id),
})
export const JTagSDDatasetRelations = relations(JTagSDDataset, ({ one }) => ({
	tag: one(Tag, {
		fields: [JTagSDDataset.tagName],
		references: [Tag.name],
	}),
	dataset: one(SDDataset, {
		fields: [JTagSDDataset.datasetId],
		references: [SDDataset.id],
	}),
}))
