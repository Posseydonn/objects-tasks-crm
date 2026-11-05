import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readAll } from '../src/lib/readAll.ts';
import { oldest } from '../src/lib/order.ts';

test('history retains microsecond ordering and uses id only for actual ties', () => {
 const earlier={id:'z',created_at:'2026-11-05T10:00:00.123001+00:00'};
 const later={id:'a',created_at:'2026-11-05T10:00:00.123002+00:00'};
 assert(oldest(earlier,later)<0);
 assert(oldest({...earlier,id:'a'},earlier)<0);
});
const sourceRows = () => Array.from({length:1251}, (_,id)=>({id:String(id).padStart(5,'0')}));
function server(source, after, cap=137) { return source.filter(row=>after===undefined || row.id>after).slice(0,cap); }
test('loads beyond the server cap using the last immutable id', async()=>{
 const source=sourceRows(); let calls=0;
 const rows=await readAll(after=>{calls++;return Promise.resolve({data:server(source,after),error:null});});
 assert.deepEqual(rows,source); assert.equal(calls,11);
});
test('deleting an earlier row between pages does not skip a surviving row', async()=>{
 const source=sourceRows(); const expected=source.slice();let first=true;
 const rows=await readAll(after=>{const data=server(source,after);if(first){first=false;source.shift();}return Promise.resolve({data,error:null});});
 assert.deepEqual(rows,expected);
});
test('inserting an earlier row does not duplicate already read rows', async()=>{
 const source=sourceRows();const expected=source.slice();let first=true;
 const rows=await readAll(after=>{const data=server(source,after);if(first){first=false;source.unshift({id:'-new'});}return Promise.resolve({data,error:null});});
 assert.deepEqual(rows,expected);
});
test('a failed later page rejects rather than showing a partial list', async()=>{
 await assert.rejects(readAll(after=>Promise.resolve(after===undefined?{data:[{id:'1'}],error:null}:{data:null,error:new Error('aborted')})),/aborted/);
});
