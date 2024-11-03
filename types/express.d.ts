import express from 'express'
import { JWTPayload } from '$/service/Auth'

declare global {
	namespace Express {
		interface Request {
			user?: JWTPayload
		}
	}
}
