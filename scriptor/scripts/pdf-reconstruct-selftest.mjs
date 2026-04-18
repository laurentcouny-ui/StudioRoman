/**
 * Vérifie la reconstruction PDF (lignes + paragraphes) sans bundler.
 */
import assert from 'node:assert'
import {
  groupPdfTextItemsIntoLines,
  reconstructPdfParagraphsFromLines,
} from '../src/import/pdf/reconstructParagraphs.js'

function glyph(str, x, y, w = 30, height = 12) {
  return { str, transform: [1, 0, 0, 1, x, y], width: w, height }
}

let lines = groupPdfTextItemsIntoLines([glyph('a', 0, 100), glyph('b', 20, 100)])
assert.equal(lines.length, 1)
assert.match(lines[0].text, /a/)
assert.match(lines[0].text, /b/)

lines = groupPdfTextItemsIntoLines([glyph('top', 0, 200), glyph('bot', 0, 170)])
assert.equal(lines.length, 2)

lines = groupPdfTextItemsIntoLines([glyph('foo\u00adbar', 0, 100)])
assert.equal(lines[0].text, 'foobar')

const merged = reconstructPdfParagraphsFromLines([
  { text: 'Une ligne courte sans point', width: 50 },
  { text: 'et la suite en minuscule.', width: 400 },
])
assert.ok(!merged.includes('\n\n'), merged)

const splitStrong = reconstructPdfParagraphsFromLines([
  { text: 'Fin claire.', width: 200 },
  { text: 'Nouveau bloc.', width: 200 },
])
assert.ok(splitStrong.includes('\n\n'), splitStrong)

const dia = reconstructPdfParagraphsFromLines([
  { text: 'Il parla.', width: 200 },
  { text: '— «Bonjour', width: 200 },
])
assert.ok(dia.includes('\n\n'), dia)

const hy = reconstructPdfParagraphsFromLines([
  { text: 'inter-', width: 100 },
  { text: 'national', width: 100 },
])
assert.equal(hy, 'international')

console.log('pdf-reconstruct-selftest: OK')
