import Axios from 'axios'

import * as Env from '@env'

export const httpClient = Axios.create({
	baseURL: 'https://civitai.com',
	headers: {
		Authorization: `Bearer ${Env.SPARKUI_CORE_CIVITAI_KEY}`,
	},
})
