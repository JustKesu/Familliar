import { useContext, type ReactNode } from 'react'
import { abilityModifier } from '../calculation/abilityScores'
import { RollButton } from '../dice/RollButton'
import type { RollReport } from '../dice/RollHistory'
import { RollReportContext } from '../dice/RollUi'
import { plainName } from '../encounters/trackedUses'
import { Entries, Markup, MarkupRollContext } from '../markup'
import { ABILITY_COLUMNS, formatModifier, formatSize, titleCase } from '../sheet/BeastStatBlock'
import { monsterInitiative, monsterSave, type LegendaryGroup, type Monster, type MonsterEntryBlock } from './monsterData'
import { challengeText, defenceText, formatAc, formatAlignment, formatMonsterSpeed, formatMonsterType, legendaryUsesText, spellcastingFor } from './monsterFormat'

function Line({ label, values }: { label: string; values: string[] }): ReactNode {
	if (values.length === 0) return null
	return (
		<p className="beast__line">
			<strong>{label}</strong> <Markup text={values.join(', ')} />
		</p>
	)
}

type Rolls = { creature: string; onRoll: (report: RollReport) => void } | null

/** D436: without a DM roll handler the value is plain text, as before. */
function Value({ rolls, modifier, label, children }: { rolls: Rolls; modifier: number; label: string; children: string }): ReactNode {
	if (!rolls) return children
	return (
		<RollButton modifier={modifier} label={`${rolls.creature} · ${label}`} onRoll={rolls.onRoll}>
			{children}
		</RollButton>
	)
}

function RollScope({ rolls, name, children }: { rolls: Rolls; name: string; children: ReactNode }): ReactNode {
	if (!rolls) return children
	return <MarkupRollContext.Provider value={{ prefix: `${rolls.creature} · ${name}`, onRoll: rolls.onRoll }}>{children}</MarkupRollContext.Provider>
}

function Blocks({ title, blocks, intro, rolls }: { title: string; blocks: MonsterEntryBlock[]; intro?: string; rolls: Rolls }): ReactNode {
	if (blocks.length === 0) return null
	return (
		<section className="beast__blocks" aria-label={title}>
			<h4>{title}</h4>
			{intro && <p className="beast__line">{intro}</p>}
			<ul>
				{blocks.map((block, index) => {
					const entries = block.entries ?? []
					// A printed stat block runs the name into the first paragraph; every MON-1 block starts with a string (DATA.md MON-3).
					const lead = typeof entries[0] === 'string' ? entries[0] : null
					const name = block.name && (
						<strong className="beast__block-name">
							<Markup text={block.name} />.{' '}
						</strong>
					)
					return (
						<li key={index} className="monster-card__block">
							<RollScope rolls={rolls} name={block.name ? plainName(block.name) : 'Lair'}>
								{lead !== null ? (
									<p className="mk-p">
										{name}
										<Markup text={lead} />
									</p>
								) : (
									name
								)}
								<Entries entries={lead !== null ? entries.slice(1) : entries} />
							</RollScope>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

export function MonsterStatBlock({ monster, group, rollName }: { monster: Monster; group?: LegendaryGroup; rollName?: string }): ReactNode {
	const onRoll = useContext(RollReportContext)
	const rolls: Rolls = onRoll ? { creature: rollName ?? monster.name, onRoll } : null
	const skills = Object.entries(monster.skill ?? {})
	const senses = [...(monster.senses ?? [])]
	if (monster.passive !== undefined) senses.push(`Passive Perception ${monster.passive}`)
	const initiative = formatModifier(monsterInitiative(monster)) + (monster.initiative?.advantageMode === 'adv' ? ' (advantage)' : '')
	const kind = [`${formatSize(monster.size)} ${formatMonsterType(monster.type)}`, formatAlignment(monster.alignment)].filter(Boolean).join(', ')
	const legendary = [...(monster.legendary ?? []), ...spellcastingFor(monster, 'legendary')]

	return (
		<article className="monster-card" aria-label={`${monster.name} stat block`}>
			<h2 className="monster-card__name">{monster.name}</h2>
			<div className="beast__body">
				<p className="beast__kind">{kind}</p>
				<p className="beast__vitals">
					<span>
						<strong>AC</strong> <Markup text={formatAc(monster.ac)} />
					</span>
					<span>
						<strong>Initiative</strong> {initiative}
					</span>
					<span>
						<strong>HP</strong> {monster.hp.average ?? '—'}
						{monster.hp.formula ? ` (${monster.hp.formula})` : ''}
					</span>
					<span>
						<strong>Speed</strong> <Markup text={formatMonsterSpeed(monster.speed)} />
					</span>
				</p>

				<ul className="beast__abilities monster-card__abilities">
					{ABILITY_COLUMNS.map(([key, label]) => {
						const save = monsterSave(monster, key)
						const modifier = abilityModifier(monster[key])
						return (
							<li key={key}>
								<span className="beast__ability-label">{label}</span>
								<span className="beast__ability-score">{monster[key]}</span>
								<span className="beast__ability-modifier">
									(
									<Value rolls={rolls} modifier={modifier} label={`${label} check`}>
										{formatModifier(modifier)}
									</Value>
									)
								</span>
								<span className={save.proficient ? 'monster-card__save monster-card__save--proficient' : 'monster-card__save'}>
									save{' '}
									<Value rolls={rolls} modifier={save.bonus} label={`${label} save`}>
										{formatModifier(save.bonus)}
									</Value>
								</span>
							</li>
						)
					})}
				</ul>

				{rolls && skills.length > 0 ? (
					<p className="beast__line">
						<strong>Skills</strong>{' '}
						{skills.map(([skill, bonus], index) => {
							const modifier = Number.parseInt(bonus, 10)
							return (
								<span key={skill}>
									{index > 0 && ', '}
									{titleCase(skill)}{' '}
									{Number.isNaN(modifier) ? (
										bonus
									) : (
										<Value rolls={rolls} modifier={modifier} label={titleCase(skill)}>
											{bonus}
										</Value>
									)}
								</span>
							)
						})}
					</p>
				) : (
					<Line label="Skills" values={skills.map(([skill, bonus]) => `${titleCase(skill)} ${bonus}`)} />
				)}
				<Line label="Senses" values={senses} />
				<Line label="Languages" values={monster.languages ?? []} />
				<Line label="Immunities" values={(monster.immune ?? []).map(defenceText)} />
				<Line label="Resistances" values={(monster.resist ?? []).map(defenceText)} />
				<Line label="Vulnerabilities" values={(monster.vulnerable ?? []).map(defenceText)} />
				<Line label="Condition immunities" values={(monster.conditionImmune ?? []).map(defenceText)} />
				<p className="beast__line">
					<strong>CR</strong> {challengeText(monster)}
				</p>

				<Blocks title="Traits" blocks={monster.trait ?? []} rolls={rolls} />
				<Blocks title="Actions" blocks={[...(monster.action ?? []), ...spellcastingFor(monster, 'action')]} rolls={rolls} />
				<Blocks title="Bonus Actions" blocks={[...(monster.bonus ?? []), ...spellcastingFor(monster, 'bonus')]} rolls={rolls} />
				<Blocks title="Reactions" blocks={[...(monster.reaction ?? []), ...spellcastingFor(monster, 'reaction')]} rolls={rolls} />
				<Blocks title="Legendary Actions" blocks={legendary} intro={legendaryUsesText(monster)} rolls={rolls} />

				{group && (group.lairActions?.length || group.regionalEffects?.length) ? (
					<RollScope rolls={rolls} name="Lair">
					<section className="beast__blocks monster-card__lair" aria-label="Lair">
						<h4>Lair</h4>
						{group.lairActions && group.lairActions.length > 0 && (
							<>
								<h5>Lair Actions</h5>
								<Entries entries={group.lairActions} />
							</>
						)}
						{group.regionalEffects && group.regionalEffects.length > 0 && (
							<>
								<h5>Regional Effects</h5>
								<Entries entries={group.regionalEffects} />
							</>
						)}
					</section>
					</RollScope>
				) : null}
			</div>
		</article>
	)
}
