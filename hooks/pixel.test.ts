import { expect, test } from 'claude-code/testing'

import { Kit, bitmap, frame } from './pixel'

test('pixel text is five squares a glyph and a gap of one', () => {
  const kit = new Kit()
  expect(kit.width('AB', 1)).toBe(11)
  expect(kit.width('A', 4)).toBe(20)
  expect(kit.width('', 3)).toBe(0)
})

test('text uses one shared glyph per character and the definitions hold only those', () => {
  const kit = new Kit()
  const one = kit.text('AAB', 0, 0, 2, '#fff')
  expect(one.match(/<use /g)?.length).toBe(3)
  expect(one.includes('scale(2)')).toBe(true)
  const defs = kit.defs()
  expect(defs.match(/<g id="g/g)?.length).toBe(2)
  expect(defs.includes('id="g65"')).toBe(true)
  expect(defs.includes('id="g66"')).toBe(true)
})

test('text is lit from the lowercase too, and characters with no glyph are skipped', () => {
  const kit = new Kit()
  const drawn = kit.text('a~b', 0, 0, 1, '#fff')
  expect(drawn.match(/<use /g)?.length).toBe(2)
})

test('anchors move the text by its width', () => {
  const kit = new Kit()
  expect(kit.text('A', 100, 0, 2, '#fff', 'end').includes('translate(90 0)')).toBe(true)
  expect(kit.text('A', 100, 0, 2, '#fff', 'middle').includes('translate(95 0)')).toBe(true)
  expect(kit.text('A', 100, 0, 2, '#fff').includes('translate(100 0)')).toBe(true)
})

test('a counting digit starts on the face that is right at the moment it is drawn', () => {
  const kit = new Kit()
  const faces = ['0', '1', '2', '3', '4', '5']
  // 75 seconds into a 60 second cycle is 15 seconds in: a quarter of the way, so face 1 of 6.
  const digit = kit.counting(faces, 10, 20, 3, '#fff', 60, 75)
  expect(digit.includes('animation-delay:-15s')).toBe(true)
  expect(digit.includes('transform:translateY(-21px)')).toBe(true)
  expect(digit.includes('steps(6)')).toBe(true)
  expect(digit.includes('--far:-126px')).toBe(true)
})

test('a rolling digit goes from its old face to its new one and rests on the new one', () => {
  const kit = new Kit()
  const faces = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  const digit = kit.rolling(faces, 2, 7, 0, 0, 3, '#fff', 90)
  expect(digit.includes('--from:-42px')).toBe(true)
  expect(digit.includes('--to:-147px')).toBe(true)
  expect(digit.includes('transform:translateY(-147px)')).toBe(true)
  expect(digit.includes('animation-delay:90ms')).toBe(true)
})

test('clip path ids are never reused', () => {
  const kit = new Kit()
  const ids = [kit.id('c'), kit.id('c'), kit.id('r')]
  expect(new Set(ids).size).toBe(3)
})

test('a bitmap merges each row into runs and the frame is four bars', () => {
  expect(bitmap(['XX.X'], 0, 0, 2, { X: '#f00' }).match(/<rect /g)?.length).toBe(2)
  expect(bitmap(['...'], 0, 0, 2, {})).toBe('')
  expect(frame(0, 0, 50, 40, '#fff').match(/<rect /g)?.length).toBe(4)
})
