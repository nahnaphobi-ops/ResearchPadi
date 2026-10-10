import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthors, serializeAuthors } from '../authors.js';

test('Surname, Given (single author)', () => {
  assert.deepEqual(parseAuthors('Best-Ezeani, Winston '), [{ family: 'Best-Ezeani', given: 'Winston' }]);
  assert.deepEqual(parseAuthors('Mba, Nancy Mma-Ngaare'), [{ family: 'Mba', given: 'Nancy Mma-Ngaare' }]);
});

test('Surname, Initials pairs (UGSpace style)', () => {
  assert.deepEqual(parseAuthors('Amoah, A.G.B., Frimpong-Boateng, K., Baddoo, H.'), [
    { family: 'Amoah', given: 'A.G.B.' },
    { family: 'Frimpong-Boateng', given: 'K.' },
    { family: 'Baddoo', given: 'H.' },
  ]);
  assert.equal(parseAuthors('Quadt, K.A., Barfod, L., Andersen, D., Bruun, J., Gyan, B., Hassenkam, T., Ofori, M.F., Hviid, L.').length, 8);
});

test('natural order names', () => {
  assert.deepEqual(parseAuthors('Hawa Yakubu Barry'), [{ family: 'Barry', given: 'Hawa Yakubu' }]);
  assert.deepEqual(parseAuthors('Kwame Mensah, Ama Owusu'), [
    { family: 'Mensah', given: 'Kwame' },
    { family: 'Owusu', given: 'Ama' },
  ]);
  assert.deepEqual(parseAuthors('Kofi van der Puije'), [{ family: 'van der Puije', given: 'Kofi' }]);
});

test('separators, titles and noise', () => {
  assert.deepEqual(parseAuthors('Dr. Faustina Adomako, Dr. Samuel Boadu'), [
    { family: 'Adomako', given: 'Faustina' },
    { family: 'Boadu', given: 'Samuel' },
  ]);
  assert.deepEqual(parseAuthors('Mensah, K.; Owusu, A. and Boateng, Y.'), [
    { family: 'Mensah', given: 'K.' },
    { family: 'Owusu', given: 'A.' },
    { family: 'Boateng', given: 'Y.' },
  ]);
  assert.deepEqual(parseAuthors('MENSAH, KWAME'), [{ family: 'Mensah', given: 'Kwame' }]);
  assert.deepEqual(parseAuthors('Unknown'), []);
  assert.deepEqual(parseAuthors(''), []);
});

test('arrays from APIs and round-trip serialisation', () => {
  const names = parseAuthors(['Kwame Mensah', 'Ama Serwaa Owusu']);
  assert.deepEqual(names, [{ family: 'Mensah', given: 'Kwame' }, { family: 'Owusu', given: 'Ama Serwaa' }]);
  assert.deepEqual(parseAuthors(serializeAuthors(names)), names);
});
