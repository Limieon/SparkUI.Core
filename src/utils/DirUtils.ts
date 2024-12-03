import FS from 'fs'
import * as Env from '@env'

import Path from 'path'

import { v4 as uuidv4 } from 'uuid'
import { ESDItemType } from './TypeUtils'

const tempDataDir = Path.join(Env.SPARKUI_CORE_DATA_DIR, 'temp')
if (!FS.existsSync(tempDataDir)) {
	FS.mkdirSync(tempDataDir, { recursive: true })
}

export function getTempFilePath() {
	return Path.join(tempDataDir, `${Date.now()}_${uuidv4()}.tmp`)
}

export function getModelFilePath(name: string, extension: string, modelType: ESDItemType) {
	if (name.endsWith(extension)) {
		name = name.slice(0, -(extension.length + 1))
	}

	let fodlerName: string = 'unknown'
	switch (modelType) {
		case 'Checkpoint':
			fodlerName = 'checkpoint'
			break
		case 'Lora':
			fodlerName = 'lora'
			break
		case 'Embedding':
			fodlerName = 'embedding'
			break
		case 'ControlNet':
			fodlerName = 'controlnet'
			break
		case 'ControlNetPreProcessor':
			fodlerName = 'controlnet_preprocessor'
			break
		case 'VAE':
			fodlerName = 'vae'
			break
		case 'Other':
			fodlerName = 'other'
			break
	}

	let filePath = Path.join(
		Env.SPARKUI_CORE_DATA_DIR,
		'stable_diffusion',
		'models',
		fodlerName,
		`${name}_${uuidv4().slice(0, 8)}.${extension}`
	)
	if (!FS.existsSync(Path.dirname(filePath))) {
		FS.mkdirSync(Path.dirname(filePath), { recursive: true })
	}

	return filePath
}
