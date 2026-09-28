import type { ReactNode } from 'react'
import type { Beast, BeastEntryBlock, BeastSpeed } from '../beasts/beastData'
import { abilityModifier } from '../calculation/abilityScores'
import { proficiencyBonusForLevel } from '../calculation/proficiencyBonus'
import { Entries } from '../markup'

/*
 * One beast stat block, read-only. BeastStatBlock is the collapsed-by-default
 * <details> (D51's shape, the same one the feat list and the spell list use) the
 * wizard's pickers put inside an option row; BeastStatBody is the same content
 * without the wrapper, for the Extras drawer and the Manage Extras rows, which
 * open it themselves.
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

/** "Tiny Beast" — the size and type as the Extras tab and the panel rows print them. */
export function beastKind(beast: Beast): string {
	return `${formatSize(beast.size)} ${formatType(beast.type)}`
}

function formatSpeedValue(value: BeastSpeed): string {
	if (typeof value === 'number') return `${value} ft.`
	const amount = value.amount === undefined ? '' : `${value.amount} ft.`
	return value.note ? `${amount} (${value.note})`.trim() : amount
}

/** Walk speed leads unlabelled, the way a stat block prints it; every other mode is named. */
export function formatSpeed(speed: Record<string, BeastSpeed>): string {
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

/** The average hit points as a bare number — the Extras table's HIT POINTS cell. */
export function beastAverageHp(beast: Beast): string {
	return beast.hp.average === undefined ? (beast.hp.formula ?? '—') : String(beast.hp.average)
}

/**
 * Dex modifier, plus the proficiency bonus once for the creatures whose data says
 * `initiative: { proficiency: 1 }`. The bonus comes from the CR (a Beast has no
 * level): the same 2-at-1-to-4, +1 per four table the character uses.
 */
export function beastInitiative(beast: Beast): number {
	const proficiencyBonus = proficiencyBonusForLevel(Math.max(1, beast.crNumber))
	return abilityModifier(beast.dex) + (beast.initiative?.proficiency ?? 0) * proficiencyBonus
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

/** The stat block's content, unwrapped. */
export function BeastStatBody({ beast }: { beast: Beast }): ReactNode {
	const senseValues = [...(beast.senses ?? [])]
	if (beast.passive !== undefined) senseValues.push(`Passive Perception ${beast.passive}`)

	return (
		<div className="beast__body">
			<p className="beast__kind">
				{beastKind(beast)}, CR {beast.cr}
			</p>

			<p className="beast__vitals">
				<span>
					<strong>AC</strong> {beast.ac.join('/')}
				</span>
				<span>
					<strong>Initiative</strong> {formatModifier(beastInitiative(beast))}
				</span>
				<span>
					<strong>HP</strong> {formatHitPoints(beast.hp)}
				</span>
				<span>
					<strong>Speed</strong> {formatSpeed(beast.speed)}
				</span>
			</p>

			<ul className="beast__abilities">
				{ABILITY_COLUMNS.map(([key, label]) => (
					<li key={key}>
						<span className="beast__ability-label">{label}</span>
						<span className="beast__ability-score">{beast[key]}</span>
						<span className="beast__ability-modifier">({formatModifier(abilityModifier(beast[key]))})</span>
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
			<StatLine label="Resistances" values={beast.resist ?? []} />
			<StatLine label="Immunities" values={beast.immune ?? []} />
			<StatLine label="Vulnerabilities" values={beast.vulnerable ?? []} />
			<StatLine label="Condition immunities" values={beast.conditionImmune ?? []} />
			<StatLine label="Senses" values={senseValues} />
			<StatLine label="Languages" values={beast.languages ?? []} />
			<StatLine label="Gear" values={formatGear(beast.gear ?? [])} />

			<BeastBlocks title="Traits" blocks={beast.trait} />
			<BeastBlocks title="Spellcasting" blocks={beast.spellcasting?.map((block) => ({ name: block.name, entries: block.headerEntries }))} />
			<BeastBlocks title="Actions" blocks={beast.action} />
			<BeastBlocks title="Bonus actions" blocks={beast.bonus} />
			<BeastBlocks title="Reactions" blocks={beast.reaction} />
		</div>
	)
}

export function BeastStatBlock({ beast, defaultOpen = false }: { beast: Beast; defaultOpen?: boolean }): ReactNode {
	return (
		<details className="beast" open={defaultOpen}>
			<summary>
				{beast.name} — {beastKind(beast)}, CR {beast.cr}
			</summary>
			<BeastStatBody beast={beast} />
		</details>
	)
}

export default BeastStatBlock
