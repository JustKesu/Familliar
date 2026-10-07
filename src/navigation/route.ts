/*
 * The app's current view lives in the URL hash (rework R1b, D151): F5 stays
 * on the view that was open, and Back/Forward walk between views the way any
 * page navigation does. No routing library — the hash is a small closed set
 * of shapes, parsed and formatted by the two pure functions below.
 */

export type CharacterRoute =
	| { view: 'list' }
	| { view: 'new' }
	| { view: 'sheet'; id: string }
	| { view: 'edit'; id: string }
	/** D329: the class gaining the level rides in the URL for a multiclass character, so F5 keeps it. */
	| { view: 'level-up'; id: string; levelClass?: { className: string; classSource: string } }

export type Route = CharacterRoute | { view: 'markup-demo' }

const LIST_ROUTE: CharacterRoute = { view: 'list' }

/** Anything not matching one of the known shapes below is the list — including a trailing slash, which none of the patterns allow. */
export function parseRoute(hash: string): Route {
	const path = hash.startsWith('#') ? hash.slice(1) : hash
	if (path === '' || path === '/') return LIST_ROUTE
	if (path === '/new') return { view: 'new' }
	if (path === '/markup-demo') return { view: 'markup-demo' }

	const sheetMatch = /^\/character\/([^/]+)$/.exec(path)
	if (sheetMatch) return { view: 'sheet', id: decodeURIComponent(sheetMatch[1]) }

	const editMatch = /^\/character\/([^/]+)\/edit$/.exec(path)
	if (editMatch) return { view: 'edit', id: decodeURIComponent(editMatch[1]) }

	const levelUpMatch = /^\/character\/([^/]+)\/level-up$/.exec(path)
	if (levelUpMatch) return { view: 'level-up', id: decodeURIComponent(levelUpMatch[1]) }

	const levelUpClassMatch = /^\/character\/([^/]+)\/level-up\/([^/]+)\/([^/]+)$/.exec(path)
	if (levelUpClassMatch) {
		return {
			view: 'level-up',
			id: decodeURIComponent(levelUpClassMatch[1]),
			levelClass: { className: decodeURIComponent(levelUpClassMatch[2]), classSource: decodeURIComponent(levelUpClassMatch[3]) },
		}
	}

	return LIST_ROUTE
}

export function formatRoute(route: Route): string {
	switch (route.view) {
		case 'list':
			return '#/'
		case 'new':
			return '#/new'
		case 'markup-demo':
			return '#/markup-demo'
		case 'sheet':
			return `#/character/${encodeURIComponent(route.id)}`
		case 'edit':
			return `#/character/${encodeURIComponent(route.id)}/edit`
		case 'level-up':
			return route.levelClass
				? `#/character/${encodeURIComponent(route.id)}/level-up/${encodeURIComponent(route.levelClass.className)}/${encodeURIComponent(route.levelClass.classSource)}`
				: `#/character/${encodeURIComponent(route.id)}/level-up`
	}
}
