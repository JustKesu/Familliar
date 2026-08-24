import type { ReactNode } from 'react'
import type { Beast, BeastEntryBlock, BeastSpeed } from '../beasts/beastData'
import { abilityModifier } from '../calculation/abilityScores'
import { Entries } from '../markup'

/*
 * One beast stat block, read-only, collapsed by default (D51's <details>
 * shape, the same one the feat list and the spell list use) so a list of
 * them does not flood the sheet. `defaultOpen` is for the one block a sheet
 * shows on its own — the currently summoned familiar — where a player would
 * otherwise have to open it every visit.
 *
 * Trait and action text goes through the PLAIN markup renderer, not
 * ResolvedEntries: beasts.json carries no ref* node anywhere
 * (scripts/summarize-beast-display-shapes.js), so the feature resolver and
 * the data it needs would buy nothing here.
 *
 * Every field below the mandatory ones is optional — a beast with no skills,
 * no senses or no traits renders without the heading rather than with an
 * empty one.
 */

const SIZE_LABELS: Record<string, string> = {
	T: 'Tiny',
	S: 'Small',
	M: 'Medium',
	L: 'Large',
	H: 'Huge',
	G: 'Gargantuan',
}

const SAVE_LABELS: Record<string, string> = {
	str: 'Str',
	dex: 'Dex',
	con: 'Con',
	int: 'Int',
	wis: 'Wis',
	cha: 'Cha',
}

/** The six scores in the order a printed stat block lists them. */
const ABILITY_COLUMNS: ReadonlyArray<readonly [key: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', label: string]> = [
	['str', 'STR'],
	['dex', 'DEX'],
	['con', 'CON'],
	['int', 'INT'],
	['wis', 'WIS'],
	['cha', 'CHA'],
]

function formatModifier(modifier: number): string {
	return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

function titleCase(value: string): string {
	return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

function formatSize(size: string[]): string {
	return size.map((code) => SIZE_LABELS[code] ?? code).join('/')
}

function formatType(type: Beast['type']): string {
	if (typeof type === 'string') return titleCase(type)
	const base = titleCase(type.type)
	if (type.swarmSize) return `Swarm of ${SIZE_LABELS[type.swarmSize] ?? type.swarmSize} ${base}s`
	if (type.tags && type.tags.length > 0) return `${base} (${type.tags.join(', ')})`
	return base
}

function formatSpeedValue(value: BeastSpeed): string {
	if (typeof value === 'number') return `${value} ft.`
	const amount = value.amount === undefined ? '' : `${value.amount} ft.`
	return value.note ? `${amount} (${value.note})`.trim() : amount
}

/** Walk speed leads unlabelled, the way a stat block prints it; every other mode is named. */
function formatSpeed(speed: Record<string, BeastSpeed>): string {
	const parts: string[] = []
	if (speed.walk !== undefined) parts.push(formatSpeedValue(speed.walk))
	for (const [mode, value] of Object.entries(speed)) {
		if (mode === 'walk') continue
		parts.push(`${mode} ${formatSpeedValue(value)}`)
	}
	return parts.join(', ')
}

function formatHitPoints(hp: Beast['hp']): string {
	if (hp.average === undefined) return hp.formula ?? '—'
	return hp.formula ? `${hp.average} (${hp.formula})` : `${hp.average}`
}

/** Renders one labelled line, or nothing at all when the beast has no such values. */
function StatLine({ label, values }: { label: string; values: string[] }): ReactNode {
	if (values.length === 0) return null
	return (
		<p className="beast__line">
			<strong>{label}</strong> {values.join(', ')}
		</p>
	)
}

function BeastBlocks({ title, blocks }: { title: string; blocks: BeastEntryBlock[] | undefined }): ReactNode {
	if (!blocks || blocks.length === 0) return null
	return (
		<div className="beast__blocks">
			<h4>{title}</h4>
			<ul>
				{blocks.map((block, index) => (
					<li key={index}>
						{block.name && <strong className="beast__block-name">{block.name}. </strong>}
						<Entries entries={block.entries ?? []} />
					</li>
				))}
			</ul>
		</div>
	)
}

/** Item references arrive as "shortsword|xphb" — the source half is bookkeeping, not stat-block text. */
function formatGear(gear: string[]): string[] {
	return gear.map((entry) => titleCase(entry.split('|')[0]))
}

export function BeastStatBlock({ beast, defaultOpen = false }: { beast: Beast; defaultOpen?: boolean }): ReactNode {
	const senseValues = [...(beast.senses ?? [])]
	if (beast.passive !== undefined) senseValues.push(`Passive Perception ${beast.passive}`)

	return (
		<details className="beast" open={defaultOpen}>
			<summary>
				{beast.name} — {formatSize(beast.size)} {formatType(beast.type)}, CR {beast.cr}
			</summary>

			<p className="beast__line">
				<strong>AC</strong> {beast.ac.join('/')} <strong>HP</strong> {formatHitPoints(beast.hp)} <strong>Speed</strong>{' '}
				{formatSpeed(beast.speed)}
			</p>

			<ul className="beast__abilities">
				{ABILITY_COLUMNS.map(([key, label]) => (
					<li key={key}>
						{label} {beast[key]} ({formatModifier(abilityModifier(beast[key]))})
					</li>
				))}
			</ul>

			<StatLine
				label="Saves"
				values={Object.entries(beast.save ?? {}).map(([ability, bonus]) => `${SAVE_LABELS[ability] ?? titleCase(ability)} ${bonus}`)}
			/>
			<StatLine
				label="Skills"
				values={Object.entries(beast.skill ?? {}).map(([skill, bonus]) => `${titleCase(skill)} ${bonus}`)}
			/>
			<StatLine label="Senses" values={senseValues} />
			<StatLine label="Resistances" values={beast.resist ?? []} />
			<StatLine label="Immunities" values={beast.immune ?? []} />
			<StatLine label="Vulnerabilities" values={beast.vulnerable ?? []} />
			<StatLine label="Condition immunities" values={beast.conditionImmune ?? []} />
			<StatLine label="Languages" values={beast.languages ?? []} />
			<StatLine label="Gear" values={formatGear(beast.gear ?? [])} />

			<BeastBlocks title="Traits" blocks={beast.trait} />
			<BeastBlocks title="Spellcasting" blocks={beast.spellcasting?.map((block) => ({ name: block.name, entries: block.headerEntries }))} />
			<BeastBlocks title="Actions" blocks={beast.action} />
			<BeastBlocks title="Bonus actions" blocks={beast.bonus} />
			<BeastBlocks title="Reactions" blocks={beast.reaction} />
		</details>
	)
}

export default BeastStatBlock
