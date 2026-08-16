/*
 * Confirms "The Celestial" (XGE) carries `reprintedAs` naming "Celestial
 * Patron" (XPHB) as its successor, so subclassData.ts's D31 dedup excludes
 * it from the picker — only "Celestial Patron"'s `prepared` shape (already
 * handled) is ever offered/selected. Resolves the earlier confusion: the
 * rank-keyed `expanded` XGE entry is dead data as far as this app goes.
 */
const fs = require('fs')
const path = require('path')

const classes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'))
const theCelestial = classes.find((c) => c.entryType === 'subclass' && c.name === 'The Celestial' && c.className === 'Warlock')
console.log('reprintedAs:', JSON.stringify(theCelestial?.reprintedAs))
