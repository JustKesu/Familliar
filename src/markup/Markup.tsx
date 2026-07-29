/*
 * Markup — layer 2 of the renderer: React presentation.
 *
 * <Markup>  renders one markup STRING (tags become styled spans).
 * <Entries> renders an `entries` ARRAY, recursing through nested objects.
 *
 * This layer owns every display decision. The parser and the tag table know
 * nothing about React, and nothing here changes when a tag is added.
 *
 * Cross-references render as plain styled text, not links: routing does not
 * exist yet (PHASE1.md section D). The information needed to link them is
 * preserved on the element — `data-ref-*` attributes carry the target name,
 * source and category — so adding links later is a change to this file alone.
 */

import { Fragment, type ReactNode } from 'react'
import { parseMarkup } from './parseMarkup'
import { resolveTag } from './tags'
import {
	asArray,
	asNumber,
	asString,
	entryBody,
	entryType,
	formatCellRoll,
	formatToRoll,
	isEntryObject,
	signedNumber,
	uidName,
} from './entryTypes'
import { unknownEntryWarnings } from './warnings'

/* ============================================================================
 * SECTION 1 — MARKUP STRINGS
 * ==========================================================================*/

export function Markup({ text }: { text: string }): ReactNode {
	const nodes = parseMarkup(text)

	return nodes.map((node, index) => {
		if (node.kind === 'text') return <Fragment key={index}>{node.text}</Fragment>

		const tag = resolveTag(node)

		// The display text may itself contain tags, so recurse. This is what
		// makes nested tags work, and it is the only place nesting is handled.
		const inner = <Markup text={tag.display} />

		if (tag.kind === 'emphasis') {
			return tag.emphasis === 'bold' ? (
				<strong key={index}>{inner}</strong>
			) : (
				<em key={index}>{inner}</em>
			)
		}

		if (tag.kind === 'reference' && tag.reference) {
			return (
				<span
					key={index}
					className={`mk-ref mk-ref--${tag.name}`}
					data-ref-category={tag.reference.category}
					data-ref-name={tag.reference.name}
					data-ref-source={tag.reference.source}
				>
					{inner}
				</span>
			)
		}

		return (
			<span
				key={index}
				className={tag.isUnknown ? 'mk-value mk-value--unknown' : `mk-value mk-value--${tag.name}`}
			>
				{inner}
			</span>
		)
	})
}

/* ============================================================================
 * SECTION 2 — UNKNOWN ENTRY TYPE REPORTING
 * ==========================================================================*/

const ABILITY_NAMES: Record<string, string> = {
	str: 'Strength',
	dex: 'Dexterity',
	con: 'Constitution',
	int: 'Intelligence',
	wis: 'Wisdom',
	cha: 'Charisma',
}

/** Expands a 5etools ability abbreviation ("int") to its full name. */
function abilityName(abbreviation: string): string {
	return ABILITY_NAMES[abbreviation] ?? abbreviation
}

function warnUnknownEntryType(type: string): void {
	unknownEntryWarnings.warn(
		type,
		`[markup] Unhandled entry type "${type}". Rendering its body if it has ` +
			`one. Add it to src/markup/Markup.tsx and re-run \`npm run survey-markup\`.`,
	)
}

/* ============================================================================
 * SECTION 3 — ENTRY ARRAYS
 * ==========================================================================*/

export function Entries({ entries }: { entries: unknown }): ReactNode {
	const list = asArray(entries) ?? [entries]
	return list.map((entry, index) => <Entry key={index} entry={entry} />)
}

export function Entry({ entry }: { entry: unknown }): ReactNode {
	if (entry === null || entry === undefined) return null

	if (typeof entry === 'string') {
		return (
			<p>
				<Markup text={entry} />
			</p>
		)
	}

	if (typeof entry === 'number') return <p>{entry}</p>

	if (Array.isArray(entry)) return <Entries entries={entry} />

	if (!isEntryObject(entry)) return null

	return <TypedEntry node={entry} />
}

/**
 * Renders content that must stay inline — a list item's body, a table cell.
 * Strings become bare text rather than paragraphs.
 */
function InlineEntries({ entries }: { entries: unknown[] }): ReactNode {
	return entries.map((entry, index) => {
		if (typeof entry === 'string') {
			return <Markup key={index} text={entry} />
		}
		if (typeof entry === 'number') return <Fragment key={index}>{entry}</Fragment>
		return <Entry key={index} entry={entry} />
	})
}

function TypedEntry({ node }: { node: Record<string, unknown> }): ReactNode {
	const type = entryType(node)
	const name = asString(node['name'])

	switch (type) {
		/* A titled block of prose. The commonest type by far (1,414). */
		case undefined:
		case 'entries':
		case 'section': {
			return (
				<section className="mk-entries">
					{name && <h4 className="mk-entries__name">{name}</h4>}
					<Entries entries={entryBody(node)} />
				</section>
			)
		}

		/* A callout box. */
		case 'inset':
		case 'insetReadaloud': {
			return (
				<aside className="mk-inset">
					{name && <h4 className="mk-inset__name">{name}</h4>}
					<Entries entries={entryBody(node)} />
				</aside>
			)
		}

		case 'list': {
			const style = asString(node['style'])
			const columns = asNumber(node['columns'])
			return (
				<ul
					className={`mk-list${style ? ` mk-list--${style}` : ''}`}
					style={columns ? { columnCount: columns } : undefined}
				>
					{(asArray(node['items']) ?? []).map((item, index) => (
						<ListItem key={index} item={item} />
					))}
				</ul>
			)
		}

		/* A list entry with a bold lead-in: "Skill Proficiencies: History and …" */
		case 'item':
		case 'itemSpell':
		case 'itemSub': {
			return <ListItem item={node} />
		}

		case 'table': {
			return <EntryTable node={node} />
		}

		/* "Choose 1 of the following:" wrapping a set of feature references. */
		case 'options': {
			const count = asNumber(node['count'])
			return (
				<div className="mk-options">
					<p className="mk-options__label">
						Choose {count ?? 1} of the following:
					</p>
					<Entries entries={entryBody(node)} />
				</div>
			)
		}

		/* Inline numeric/dice fragments. These appear inside class tables. */
		case 'dice': {
			return <span className="mk-value mk-value--dice">{formatToRoll(node['toRoll'])}</span>
		}
		case 'bonus': {
			const value = asNumber(node['value'])
			return (
				<span className="mk-value mk-value--bonus">
					{value === undefined ? '' : signedNumber(value)}
				</span>
			)
		}
		case 'bonusSpeed': {
			const value = asNumber(node['value'])
			return (
				<span className="mk-value mk-value--bonus">
					{value === undefined ? '' : `${signedNumber(value)} ft.`}
				</span>
			)
		}
		case 'cell': {
			return <span className="mk-value mk-value--cell">{formatCellRoll(node['roll'])}</span>
		}

		/*
		 * Pointers to a feature defined in another file. Resolving them needs a
		 * cross-file lookup the renderer does not have, so we show the target's
		 * name and keep the full UID on the element for whatever resolves it
		 * later (PHASE1.md section D).
		 */
		case 'refClassFeature':
			return <EntryRef uid={asString(node['classFeature'])} kind="classFeature" />
		case 'refSubclassFeature':
			return <EntryRef uid={asString(node['subclassFeature'])} kind="subclassFeature" />
		case 'refOptionalfeature':
			return <EntryRef uid={asString(node['optionalfeature'])} kind="optionalfeature" />
		case 'refFeat':
			return <EntryRef uid={asString(node['feat'])} kind="feat" />

		/* A save DC derived from an ability score, e.g. "Arcane Shot" (int). */
		case 'abilityDc': {
			const abilities = (asArray(node['attributes']) ?? [])
				.map((a) => asString(a))
				.filter((a): a is string => a !== undefined)
				.map(abilityName)
			return (
				<p className="mk-value mk-value--abilityDc">
					{name && <strong>{name} </strong>}
					save DC uses your {abilities.join(' or ')} modifier.
				</p>
			)
		}

		/*
		 * A pointer to a creature or object statblock in another file. Like the
		 * ref* types above, D7 means no cross-file lookup — show the target's
		 * name and keep its identifiers on the element for later resolution.
		 */
		case 'statblock': {
			const source = asString(node['source'])
			const tag = asString(node['tag'])
			if (!name) return null
			return (
				<p>
					<span
						className="mk-ref mk-ref--statblock"
						data-ref-category={tag}
						data-ref-name={name}
						data-ref-source={source}
					>
						{name}
					</span>
				</p>
			)
		}

		default: {
			warnUnknownEntryType(type)
			const body = entryBody(node)
			if (body.length === 0) return null
			return (
				<section className="mk-entries">
					{name && <h4 className="mk-entries__name">{name}</h4>}
					<Entries entries={body} />
				</section>
			)
		}
	}
}

function ListItem({ item }: { item: unknown }): ReactNode {
	if (typeof item === 'string') {
		return (
			<li className="mk-list__item">
				<Markup text={item} />
			</li>
		)
	}

	if (!isEntryObject(item)) return <li className="mk-list__item">{String(item ?? '')}</li>

	const name = asString(item['name'])
	return (
		<li className="mk-list__item">
			{name && <strong className="mk-list__name">{name} </strong>}
			<InlineEntries entries={entryBody(item)} />
		</li>
	)
}

function EntryRef({ uid, kind }: { uid: string | undefined; kind: string }): ReactNode {
	if (!uid) return null
	return (
		<p>
			<span
				className={`mk-ref mk-ref--${kind}`}
				data-ref-category={kind}
				data-ref-name={uidName(uid)}
				data-ref-uid={uid}
			>
				{uidName(uid)}
			</span>
		</p>
	)
}

function EntryTable({ node }: { node: Record<string, unknown> }): ReactNode {
	const caption = asString(node['caption'])
	const colLabels = asArray(node['colLabels']) ?? []
	const colStyles = asArray(node['colStyles']) ?? []
	const rows = asArray(node['rows']) ?? []
	const footnotes = asArray(node['footnotes']) ?? []

	const styleAt = (index: number): string | undefined => asString(colStyles[index])

	return (
		<div className="mk-table-wrap">
			<table className="mk-table">
				{caption && <caption className="mk-table__caption">{caption}</caption>}
				{colLabels.length > 0 && (
					<thead>
						<tr>
							{colLabels.map((label, index) => (
								<th key={index} scope="col" className={styleAt(index)}>
									<Markup text={asString(label) ?? ''} />
								</th>
							))}
						</tr>
					</thead>
				)}
				<tbody>
					{rows.map((row, rowIndex) => (
						<TableRow key={rowIndex} row={row} styleAt={styleAt} />
					))}
				</tbody>
			</table>
			{footnotes.length > 0 && (
				<div className="mk-table__footnotes">
					<InlineEntries entries={footnotes} />
				</div>
			)}
		</div>
	)
}

function TableRow({
	row,
	styleAt,
}: {
	row: unknown
	styleAt: (index: number) => string | undefined
}): ReactNode {
	// A row is normally an array of cells. The `{type:"row", row:[…]}` form
	// does not occur in our data but costs nothing to accept.
	const cells = asArray(row) ?? (isEntryObject(row) ? asArray(row['row']) : undefined) ?? [row]

	return (
		<tr>
			{cells.map((cell, index) => (
				<td key={index} className={styleAt(index)}>
					<InlineEntries entries={[cell]} />
				</td>
			))}
		</tr>
	)
}
