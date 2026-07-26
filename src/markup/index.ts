/*
 * The 5etools markup renderer.
 *
 * Build order step 1 (PHASE1.md section E). Used everywhere text from data/
 * is displayed, because none of that text is plain English.
 *
 *     <Markup text="Deal {@damage 8d6} damage." />
 *     <Entries entries={spell.entries} />
 */

export { parseMarkup, splitTagArgs, hasMarkup } from './parseMarkup'
export type { MarkupNode, MarkupTagNode, MarkupTextNode } from './parseMarkup'

export {
	resolveTag,
	getHandledTagNames,
	resetUnknownTagWarnings,
	getUnknownTagsSeen,
} from './tags'
export type { ResolvedTag, TagKind, TagReference } from './tags'

export { Markup, Entries, Entry } from './Markup'

export { unknownEntryWarnings, unknownTagWarnings } from './warnings'
export type { WarnOnceRegistry } from './warnings'
