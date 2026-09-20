import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRecent, remember, saveRecent } from '../src/recent.ts';
test('recent cards are unique, newest first and capped at five', () => {
  assert.deepEqual(remember(['A','B'], 'B'), ['B','A']);
  assert.equal(remember(Array.from({length:5}, (_,i)=>String(i)), 'new').length, 5);
});
test('recent storage survives reload, clearing, corrupt data and blocked storage', () => {
  let value = '';
  const storage = {getItem:()=>value, setItem:(_key:string, v:string)=>{value=v;}};
  saveRecent(storage, ['Sol Ring']); assert.deepEqual(readRecent(storage), ['Sol Ring']);
  saveRecent(storage, []); assert.deepEqual(readRecent(storage), []);
  value = '{bad'; assert.deepEqual(readRecent(storage), []);
  value = '[1,null,"Sol Ring","Sol Ring"]'; assert.deepEqual(readRecent(storage), ['Sol Ring']);
  const blocked = {getItem:()=>{throw Error();},setItem:()=>{throw Error();}};
  assert.deepEqual(readRecent(blocked), []); assert.doesNotThrow(()=>saveRecent(blocked,['A']));
});
