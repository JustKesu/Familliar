import { useEffect, useState, type ReactNode } from 'react'
import { loadDataFile } from '../dataLoader/dataLoader'
import { computeSize, computeSpeed, type SpeciesTraitsData } from '../calculation/speciesTraits'
import { speciesTraitsFrom, type SpeciesTrait } from '../sheet/speciesTraitNames'
import { Entries } from '../markup'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import { SIZE_NAMES } from './SpeciesSizePicker'

type Loaded = { key: string; raw: SpeciesTraitsData[]; traits: SpeciesTrait[]; creatureTypes: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function capitalise(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1)
}

/** `creatureTypes` is absent from 24 of 81 species (DATA.md), so the pair is left out rather than guessed. */
function creatureTypesOf(parsed: unknown, name: string, source: string): string[] {
	if (!Array.isArray(parsed)) return []
	const entry = parsed.find((candidate) => isRecord(candidate) && candidate['name'] === name && candidate['source'] === source)
	const types = isRecord(entry) ? entry['creatureTypes'] : undefined
	return Array.isArray(types) ? types.filter((type): type is string => typeof type === 'string') : []
}

function Stat({ label, value }: { label: string; value: string }): ReactNode {
	return (
		<div className="species-card__stat">
			<dt className="species-card__label">{label}</dt>
			<dd className="species-card__value">{value}</dd>
		</div>
	)
}

/**
 * W6: the chosen species' creature type, size, speed and every trait with its full text, read from the same
 * species.json entry the sheet's Species Traits group uses (speciesTraitsFrom). Loaded in an effect keyed on the
 * species (D116); `size` follows the player's own size pick (D175) without a reload.
 */
export function SpeciesCard({ species, chosenSize }: { species: { name: string; source: string }; chosenSize: string | null }): ReactNode {
	const [loaded, setLoaded] = useState<Loaded | null>(null)
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)
	const key = `${species.name}|${species.source}`

	useEffect(() => {
		let cancelled = false
		setLoaded(null)
		loadDataFile('data/species.json')
			.then((parsed) => {
				if (cancelled) return
				setLoaded({
					key,
					raw: parsed as SpeciesTraitsData[],
					traits: speciesTraitsFrom({ species: { name: species.name, source: species.source } }, parsed),
					creatureTypes: creatureTypesOf(parsed, species.name, species.source),
				})
			})
			.catch(() => {
				/* The picker above already surfaces a failed species load; the card just stays empty. */
			})
		return () => {
			cancelled = true
		}
	}, [key, species.name, species.source])

	useEffect(() => {
		let cancelled = false
		loadResolverData()
			.then((data) => {
				if (!cancelled) setResolverData(data)
			})
			.catch(() => {
				/* Falls back to unexpanded rendering below. */
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (loaded === null || loaded.key !== key) return null

	const character = { species: { name: species.name, source: species.source }, ...(chosenSize ? { speciesSize: chosenSize } : {}) }
	const size = computeSize(character, loaded.raw)
	const speed = computeSpeed(character, loaded.raw)
	const speedText =
		speed.status === 'known'
			? [`${speed.value.walk} ft.`, ...(['fly', 'swim', 'climb'] as const).flatMap((mode) => (speed.value[mode] ? [`${mode} ${speed.value[mode]} ft.`] : []))].join(', ')
			: null

	return (
		<section className="species-card" aria-label="Species traits">
			<dl className="species-card__stats">
				{loaded.creatureTypes.length > 0 && <Stat label="Creature Type" value={loaded.creatureTypes.map(capitalise).join(', ')} />}
				{size.status === 'known' && <Stat label="Size" value={SIZE_NAMES[size.value] ?? size.value} />}
				{speedText !== null && <Stat label="Speed" value={speedText} />}
			</dl>
			<div className="species-card__traits">
				{loaded.traits.map((trait, index) => (
					<div key={`${index}|${trait.name}`} className="species-card__trait">
						<h4 className="species-card__trait-name">{trait.name}</h4>
						<div className="species-card__trait-text">{resolverData ? <ResolvedEntries entries={trait.entries} data={resolverData} /> : <Entries entries={trait.entries} />}</div>
					</div>
				))}
			</div>
		</section>
	)
}
