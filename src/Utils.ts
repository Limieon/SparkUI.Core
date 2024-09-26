import { Logger } from 'tslog'
import { SPARKUI_CORE_DEBUG } from './Env'

// Create a custom log formatter to match your desired prefix: <HH:mm:ss>[INFO]: Message
export const logger = new Logger({
	prettyLogTemplate: '<{{yyyy}}-{{mm}}-{{dd}} {{hh}}:{{MM}}:{{ss}}>[{{logLevelName}}]: ', // Custom log format
})

logger.settings.minLevel = 3
if (SPARKUI_CORE_DEBUG) {
	logger.warn('Running in debug mode!')
	logger.settings.minLevel = 0
}
