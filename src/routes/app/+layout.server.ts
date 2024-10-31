import * as Auth from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (e) => {
	if (!e.locals.user) {
		return redirect(302, '/auth/login');
	}
	return { user: e.locals.user };
};
