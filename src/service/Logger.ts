import { Logger } from 'tslog'
import { SPARKUI_CORE_DEBUG } from '@env'

const logger = new Logger({
	prettyLogTemplate: '<{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}>[{{logLevelName}}]: ',
})
logger.settings.minLevel = 3
if (SPARKUI_CORE_DEBUG) {
	logger.warn('Running in debug mode!')
	logger.settings.minLevel = 0
}

export default logger
