/*
 * parseMarkup — layer 1 of the 5etools markup renderer.
 *
 * Turns a raw string like
 *
 *     "Deal {@damage 8d6} and the target is {@condition prone|XPHB}."
 *
 * into a flat list of nodes:
 *
 *     [ {kind:'text', text:'Deal '},
 *       {kind:'tag', name:'damage', args:['8d6']},
 *       {kind:'text', text:' and the target is '},
 *       {kind:'tag', name:'condition', args:['prone','XPHB']},
 *       {kind:'text', text:'.'} ]
 *
 * This layer knows SYNTAX ONLY. It does not know that {@damage} is dice or
 * that {@condition} points at a rules entry — that is tags.ts. Keeping the
 * split means the parser never has to change when we add a tag.
 *
 * Arguments are returned raw and unsplit-further, so nothing is lost: the
 * component layer decides what to display, and a later routing layer can
 * still recover the target name and source from `args`.
 */

export interface MarkupTextNode {
	kind: 'text'
	text: string
}

export interface MarkupTagNode {
	kind: 'tag'
	/** Tag name without the "@", e.g. "spell". */
	name: string
	/** Top-level "|"-separated arguments. Pipes inside a nested tag do not split. */
	args: string[]
	/** The original source text, e.g. "{@spell Fireball|XPHB}". Kept for diagnostics. */
	raw: string
}

export type MarkupNode = MarkupTextNode | MarkupTagNode

/**
 * Finds the index of the "}" that closes the "{" at `start`.
 * Returns -1 if the braces never balance, which we treat as "not a tag".
 */
function findClosingBrace(text: string, start: number): number {
	let depth = 0
	for (let i = start; i < text.length; i++) {
		const char = text[i]
		if (char === '{') depth++
		else if (char === '}') {
			depth--
			if (depth === 0) return i
		}
	}
	return -1
}

/**
 * Splits a tag body on "|", ignoring pipes nested inside another tag.
 *
 *     "Wand|XDMG|a {@spell magic missile} wand"  ->  3 parts, not 4
 *
 * Empty arguments are preserved — they are meaningful. "{@status
 * concentration||concentrating}" has a deliberately blank source, and a blank
 * source is NOT the same as an absent one (see NOTES.md: blank means PHB 2014).
 */
export function splitTagArgs(body: string): string[] {
	const parts: string[] = []
	let current = ''
	let depth = 0

	for (const char of body) {
		if (char === '{') depth++
		else if (char === '}') depth--

		if (char === '|' && depth === 0) {
			parts.push(current)
			current = ''
		} else {
			current += char
		}
	}
	parts.push(current)
	return parts
}

/**
 * Parses a markup string into text and tag nodes.
 *
 * Anything that is not a well-formed tag is returned as literal text, so no
 * input can ever cause characters to be dropped. An unbalanced "{@" stays
 * visible as text rather than swallowing the rest of the string.
 */
export function parseMarkup(text: string): MarkupNode[] {
	const nodes: MarkupNode[] = []
	let buffer = ''

	for (let i = 0; i < text.length; i++) {
		const isTagStart = text[i] === '{' && text[i + 1] === '@'
		if (!isTagStart) {
			buffer += text[i]
			continue
		}

		const end = findClosingBrace(text, i)
		if (end === -1) {
			// Unbalanced — not a tag. Keep the character as literal text.
			buffer += text[i]
			continue
		}

		if (buffer) {
			nodes.push({ kind: 'text', text: buffer })
			buffer = ''
		}

		const raw = text.slice(i, end + 1)
		const inner = raw.slice(2, -1) // strip "{@" and "}"
		const firstSpace = inner.search(/\s/)
		const name = firstSpace === -1 ? inner : inner.slice(0, firstSpace)
		const body = firstSpace === -1 ? '' : inner.slice(firstSpace + 1)

		nodes.push({ kind: 'tag', name, args: splitTagArgs(body), raw })
		i = end
	}

	if (buffer) nodes.push({ kind: 'text', text: buffer })

	return nodes
}

/** True when the string contains at least one tag. Cheap pre-check. */
export function hasMarkup(text: string): boolean {
	return text.includes('{@')
}
