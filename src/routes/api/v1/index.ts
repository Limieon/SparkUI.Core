import { authMiddleware } from '$/service/Auth'
import { Router, Request, Response, NextFunction } from 'express'
import Logger from '@log'

const router = Router()
router.use(authMiddleware)

router.get('/status', async (req: Request, res: Response) => {
	res.send({ user: req.user })
})

export default router
