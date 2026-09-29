import { loadDataFile } from '../dataLoader/dataLoader'

/** data/rules.json (R15, D223): XPHB glossary, sense and skill texts, keyed by 5etools category. */
export interface RuleTexts {
	variantrule: RuleText[]
	sense: RuleText[]
	skill: RuleText[]
}

export interface RuleText {
	name: string
	entries: unknown[]
}

function records(value: unknown): RuleText[] {
	if (!Array.isArray(value)) return []
	return value.flatMap((entry) => {
		const record = entry as Record<string, unknown> | null
		return record && typeof record['name'] === 'string'
			? [{ name: record['name'], entries: Array.isArray(record['entries']) ? record['entries'] : [] }]
			: []
	})
}

export function extractRuleTexts(parsed: unknown): RuleTexts {
	if (typeof parsed !== 'object' || parsed === null) throw new Error('rules.json: expected a top-level object.')
	const record = parsed as Record<string, unknown>
	return { variantrule: records(record['variantrule']), sense: records(record['sense']), skill: records(record['skill']) }
}

export async function loadRuleTexts(): Promise<RuleTexts> {
	return extractRuleTexts(await loadDataFile('data/rules.json'))
}

/** Case-insensitive: granted senses carry the type in lower case ("blindsight"). */
export function findRuleText(texts: RuleTexts | null, kind: keyof RuleTexts, name: string): RuleText | undefined {
	return texts?.[kind].find((text) => text.name.toLowerCase() === name.toLowerCase())
}
