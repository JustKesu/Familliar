import type { ReactNode } from 'react'
import { abilityModifier } from '../calculation/abilityScores'
import { Entries, Markup } from '../markup'
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

function Blocks({ title, blocks, intro }: { title: string; blocks: MonsterEntryBlock[]; intro?: string }): ReactNode {
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
							{lead !== null ? (
								<p className="mk-p">
									{name}
									<Markup text={lead} />
								</p>
							) : (
								name
							)}
							<Entries entries={lead !== null ? entries.slice(1) : entries} />
						</li>
					)
				})}
			</ul>
		</section>
	)
}

export function MonsterStatBlock({ monster, group }: { monster: Monster; group?: LegendaryGroup }): ReactNode {
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
						return (
							<li key={key}>
								<span className="beast__ability-label">{label}</span>
								<span className="beast__ability-score">{monster[key]}</span>
								<span className="beast__ability-modifier">({formatModifier(abilityModifier(monster[key]))})</span>
								<span className={save.proficient ? 'monster-card__save monster-card__save--proficient' : 'monster-card__save'}>save {formatModifier(save.bonus)}</span>
							</li>
						)
					})}
				</ul>

				<Line label="Skills" values={Object.entries(monster.skill ?? {}).map(([skill, bonus]) => `${titleCase(skill)} ${bonus}`)} />
				<Line label="Senses" values={senses} />
				<Line label="Languages" values={monster.languages ?? []} />
				<Line label="Immunities" values={(monster.immune ?? []).map(defenceText)} />
				<Line label="Resistances" values={(monster.resist ?? []).map(defenceText)} />
				<Line label="Vulnerabilities" values={(monster.vulnerable ?? []).map(defenceText)} />
				<Line label="Condition immunities" values={(monster.conditionImmune ?? []).map(defenceText)} />
				<p className="beast__line">
					<strong>CR</strong> {challengeText(monster)}
				</p>

				<Blocks title="Traits" blocks={monster.trait ?? []} />
				<Blocks title="Actions" blocks={[...(monster.action ?? []), ...spellcastingFor(monster, 'action')]} />
				<Blocks title="Bonus Actions" blocks={[...(monster.bonus ?? []), ...spellcastingFor(monster, 'bonus')]} />
				<Blocks title="Reactions" blocks={[...(monster.reaction ?? []), ...spellcastingFor(monster, 'reaction')]} />
				<Blocks title="Legendary Actions" blocks={legendary} intro={legendaryUsesText(monster)} />

				{group && (group.lairActions?.length || group.regionalEffects?.length) ? (
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
				) : null}
			</div>
		</article>
	)
}
