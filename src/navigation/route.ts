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

export type DmTab = 'encounters' | 'bestiary' | 'npcs'

/** D433: `encounter` opens the setup screen inside the Encounters tab — 'new' or a saved encounter's id. D437: `newNpc` is the creation wizard for an NPC. */
export type DmRoute = { view: 'dm'; tab: DmTab; encounter?: 'new' | { id: string; run?: boolean }; newNpc?: true }

export type Route = CharacterRoute | { view: 'markup-demo' } | DmRoute

const LIST_ROUTE: CharacterRoute = { view: 'list' }

/** Anything not matching one of the known shapes below is the list — including a trailing slash, which none of the patterns allow. */
export function parseRoute(hash: string): Route {
	const path = hash.startsWith('#') ? hash.slice(1) : hash
	if (path === '' || path === '/') return LIST_ROUTE
	if (path === '/new') return { view: 'new' }
	if (path === '/markup-demo') return { view: 'markup-demo' }
	if (path === '/dm') return { view: 'dm', tab: 'encounters' }
	if (path === '/dm/bestiary') return { view: 'dm', tab: 'bestiary' }
	if (path === '/dm/npcs') return { view: 'dm', tab: 'npcs' }
	if (path === '/dm/npcs/new') return { view: 'dm', tab: 'npcs', newNpc: true }
	if (path === '/dm/encounter/new') return { view: 'dm', tab: 'encounters', encounter: 'new' }

	const encounterMatch = /^\/dm\/encounter\/([^/]+)$/.exec(path)
	if (encounterMatch) return { view: 'dm', tab: 'encounters', encounter: { id: decodeURIComponent(encounterMatch[1]) } }

	const runMatch = /^\/dm\/encounter\/([^/]+)\/run$/.exec(path)
	if (runMatch && runMatch[1] !== 'new') return { view: 'dm', tab: 'encounters', encounter: { id: decodeURIComponent(runMatch[1]), run: true } }

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
		case 'dm':
			if (route.tab === 'bestiary') return '#/dm/bestiary'
			if (route.tab === 'npcs') return route.newNpc ? '#/dm/npcs/new' : '#/dm/npcs'
			if (route.encounter === 'new') return '#/dm/encounter/new'
			if (route.encounter) return `#/dm/encounter/${encodeURIComponent(route.encounter.id)}${route.encounter.run ? '/run' : ''}`
			return '#/dm'
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
