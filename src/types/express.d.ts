import { type JWTPayload } from '../api/v1/user/index.ts'

declare global {
	namespace Express {
		interface Request {
			user: JWTPayload
		}
	}
}
