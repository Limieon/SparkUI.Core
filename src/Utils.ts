import { Logger } from 'tslog'
import { SPARKUI_CORE_DEBUG } from './Env'
import Chalk from 'chalk'

// Create a custom log formatter to match your desired prefix: <HH:mm:ss>[INFO]: Message
export const logger = new Logger({
	prettyLogTemplate: '<{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}>[{{logLevelName}}]: ', // Custom log format
})

logger.settings.minLevel = 3
if (SPARKUI_CORE_DEBUG) {
	logger.warn('Running in debug mode!')
	logger.settings.minLevel = 0
}

export enum SDModelType {
	Checkpoint,
	Lora,
	Embedding,
	ControlNet,
	ControlNetPreProcessor,
	VAE,
	Other,
}

export function createLogger(workerName: string) {
	const logger = new Logger({
		prettyLogTemplate: `<{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}>[{{logLevelName}}/${Chalk.cyan(workerName)}]: `,
	})
	logger.settings.minLevel = 3
	if (SPARKUI_CORE_DEBUG) {
		logger.settings.minLevel = 0
	}
	return logger
}

export function modelTypeFromString(type: string) {
	type = type.toLowerCase()
	switch (type) {
		case 'checkpoint':
		case 'model':
			return SDModelType.Checkpoint
		case 'lora':
			return SDModelType.Lora
		case 'embedding':
			return SDModelType.Embedding
		case 'controlnet':
			return SDModelType.ControlNet
		case 'controlnetpreprocessor':
			return SDModelType.ControlNetPreProcessor
		case 'vae':
			return SDModelType.VAE
		default:
			return SDModelType.Other
	}
}

export function getModelDir(type: SDModelType) {
	switch (type) {
		case SDModelType.Checkpoint:
			return 'stable_diffusion/checkpoints'
		case SDModelType.Lora:
			return 'stable_diffusion/lora'
		case SDModelType.Embedding:
			return 'stable_diffusion/embeddings'
		case SDModelType.ControlNet:
			return 'stable_diffusion/controlnet'
		case SDModelType.ControlNetPreProcessor:
			return 'stable_diffusion/controlnet_preprocessor'
		case SDModelType.VAE:
			return 'stable_diffusion/vae'
		default:
			return 'other'
	}
}
