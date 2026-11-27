import { compareText } from '../text/compareText'
import { monsterTypes, type Monster } from './monsterData'

export interface BestiaryFilter {
	query: string
	/** crNumber bounds, inclusive; null = no bound. */
	crMin: number | null
	crMax: number | null
	type: string
	environment: string
	source: string
}

export const EMPTY_FILTER: BestiaryFilter = { query: '', crMin: null, crMax: null, type: '', environment: '', source: '' }

export function filterMonsters(monsters: Monster[], filter: BestiaryFilter): Monster[] {
	const query = filter.query.trim().toLowerCase()
	return monsters
		.filter((monster) => {
			if (query !== '' && !monster.name.toLowerCase().includes(query)) return false
			if (filter.crMin !== null && monster.crNumber < filter.crMin) return false
			if (filter.crMax !== null && monster.crNumber > filter.crMax) return false
			if (filter.type !== '' && !monsterTypes(monster).includes(filter.type)) return false
			if (filter.environment !== '' && !(monster.environment ?? []).includes(filter.environment)) return false
			if (filter.source !== '' && monster.source !== filter.source) return false
			return true
		})
		.sort((a, b) => compareText(a.name, b.name) || compareText(a.source, b.source))
}

export interface FilterOptions {
	cr: { value: number; label: string }[]
	types: string[]
	environments: string[]
	sources: string[]
}

export function filterOptions(monsters: Monster[]): FilterOptions {
	const cr = new Map<number, string>()
	const types = new Set<string>()
	const environments = new Set<string>()
	const sources = new Set<string>()
	for (const monster of monsters) {
		cr.set(monster.crNumber, monster.cr)
		for (const type of monsterTypes(monster)) types.add(type)
		for (const environment of monster.environment ?? []) environments.add(environment)
		sources.add(monster.source)
	}
	return {
		cr: [...cr.entries()].sort((a, b) => a[0] - b[0]).map(([value, label]) => ({ value, label })),
		types: [...types].sort(),
		environments: [...environments].sort(),
		sources: [...sources].sort(),
	}
}
