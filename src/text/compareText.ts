// F-18: localeCompare without a locale follows the system language (Czech sorts "Ch" after "H"); the app is English.
const collator = new Intl.Collator('en')

export function compareText(a: string, b: string): number {
	return collator.compare(a, b)
}
