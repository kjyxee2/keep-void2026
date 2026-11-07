import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factorySearchFilter } from './search.ts';

test('search keeps (주), parentheses, dots and commas inside quoted PostgREST values', () => {
  const f = factorySearchFilter('(주)대경.이엔지, 2공장')!;
  assert.ok(f.includes('name.ilike."%(주)대경.이엔지, 2공장%"'), f);
  assert.ok(f.includes('address.ilike."%(주)대경.이엔지, 2공장%"'), f);
  assert.ok(f.includes('name.ilike."%㈜대경.이엔지, 2공장%"'), f);    // (주)와 ㈜ 둘 다
});

test('search escapes LIKE wildcards, quotes and backslashes; strips *', () => {
  assert.equal(factorySearchFilter('a_b%'), 'name.ilike."%a\\\\_b\\\\%%",address.ilike."%a\\\\_b\\\\%%"');
  assert.equal(factorySearchFilter('a"b'), 'name.ilike."%a\\"b%",address.ilike."%a\\"b%"');
  assert.equal(factorySearchFilter('ab*'), 'name.ilike."%ab%",address.ilike."%ab%"');
});

test('search needs 2+ characters after cleanup and caps at 50', () => {
  assert.equal(factorySearchFilter(' a '), null);
  assert.equal(factorySearchFilter('**'), null);
  assert.ok(factorySearchFilter('가'.repeat(80))!.includes('가'.repeat(50) + '%"'));
});
