// Real Auth + PostgREST acceptance. Credentials are read only from ignored files.
// Run: node --use-env-proxy supabase/tests/hosted-security.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const cfg=JSON.parse(fs.readFileSync(new URL('.crm-test-access.json.local',root),'utf8'));
const env=Object.fromEntries(fs.readFileSync(new URL('.env.local',root),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')];}));
const base=env.VITE_SUPABASE_URL,key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
const results=[]; const sessions=[]; let calls=0;
async function req(path,token,method='GET',body){calls++;const r=await fetch(base+path,{method,headers:{apikey:key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {ok:r.ok,status:r.status,data};}
function check(name,condition){assert.ok(condition,name);results.push(name);console.log('PASS '+name);}
const rpc=async(i,name,args)=>req('/rest/v1/rpc/'+name,sessions[i]?.access_token,'POST',args);
async function good(i,name,args){const r=await rpc(i,name,args);assert.ok(r.ok,`${name}: HTTP ${r.status} ${r.data?.code??''}`);return r.data;}
async function denied(name,i,fn,args,code){const r=await rpc(i,fn,args);check(name,!r.ok&&(!code||r.data.code===code));}
const get=async(i,table,filter='')=>{const r=await req('/rest/v1/'+table+'?select=*'+filter,sessions[i]?.access_token);assert.ok(r.ok,`read ${table}: ${r.status}`);return r.data;};
try{
for(const a of cfg.accounts){const r=await req('/auth/v1/token?grant_type=password',null,'POST',{email:a.email,password:a.password});assert.ok(r.ok,'password sign-in');sessions.push(r.data);}
check('Four real password sessions',sessions.length===4);
const [m1,m2,e1,e2]=sessions.map(s=>s.user.id);
const o=await good(0,'create_object',{p_name:'ЖК Северный — общий объект',p_address:'ул. Примерная, 10'});
const privateO=await good(1,'create_object',{p_name:'Школа — объект второго исполнителя',p_address:'ул. Учебная, 5'});
const emptyO=await good(0,'create_object',{p_name:'Детский сад — планирование',p_address:'ул. Садовая, 3'});
const create=async(title,assignee=e1,obj=o.id)=>good(0,'create_task',{p_title:title,p_description:'Вымышленная демонстрационная задача',p_object_id:obj,p_assignee_id:assignee});
const t=await create('Проверить монтаж освещения');
const foreign=await create('Проверить отделку кабинетов',e2);
await create('Принять материалы на объекте',e2,privateO.id);
check('Executor sees only own task',(await get(2,'tasks')).every(x=>x.assignee_id===e1));
check('Shared object hides other executor task',(await get(2,'tasks','&object_id=eq.'+o.id)).length===1);
check('Other object unavailable',(await get(2,'objects','&id=eq.'+privateO.id)).length===0);
check('Foreign task ID unavailable',(await get(2,'tasks','&id=eq.'+foreign.id)).length===0);
check('Foreign history unavailable',(await get(2,'task_history','&task_id=eq.'+foreign.id)).length===0);
check('Unrelated profile unavailable',(await get(2,'profiles','&id=eq.'+e2)).length===0);
check('Manager sees all executors',(await get(0,'profiles','&role=eq.executor')).length===2);
check('Second manager sees other manager task',(await get(1,'tasks','&id=eq.'+t.id)).length===1);
for(const [table,method,body] of [['tasks','POST',{title:'forge'}],['tasks','PATCH',{title:'forge'}],['tasks','DELETE',undefined],['profiles','PATCH',{role:'manager'}],['task_history','POST',{task_id:t.id,to_status:'accepted',changed_by:e1}],['task_history','PATCH',{comment:'forge'}],['task_history','DELETE',undefined]]){const r=await req('/rest/v1/'+table+'?id=eq.'+t.id,sessions[2].access_token,method,body);check('Direct '+method+' '+table+' denied',!r.ok);}
await denied('Executor cannot create object',2,'create_object',{p_name:'Hack',p_address:'Hack'},'42501');
await denied('Executor cannot edit task',2,'update_task',{p_task_id:t.id,p_title:'Hack',p_description:'',p_object_id:o.id,p_assignee_id:e2},'42501');
await denied('Manager cannot assign manager',0,'create_task',{p_title:'Hack',p_description:'',p_object_id:o.id,p_assignee_id:m1},'22023');
await denied('Whitespace title rejected',0,'create_task',{p_title:'\t\n ',p_description:'',p_object_id:o.id,p_assignee_id:e1},'22023');
await denied('Foreign status mutation denied',2,'change_task_status',{p_task_id:foreign.id,p_target_status:'in_progress'},'P0002');
const statuses=['new','in_progress','review','accepted','revision'];
async function forbiddenAt(status){const allowedManager=status==='review'?['accepted','revision']:[];const allowedExec=status==='new'||status==='revision'?['in_progress']:status==='in_progress'?['review']:[];for(const [role,allowed] of [[0,allowedManager],[2,allowedExec]]){await Promise.all(statuses.filter(x=>!allowed.includes(x)).map(target=>denied(`${role===0?'Manager':'Executor'} ${status}->${target} denied`,role,'change_task_status',{p_task_id:t.id,p_target_status:target,p_comment:'test'},'22023')));}}
await forbiddenAt('new');
const race=await Promise.all([rpc(2,'change_task_status',{p_task_id:t.id,p_target_status:'in_progress'}),rpc(2,'change_task_status',{p_task_id:t.id,p_target_status:'in_progress'})]);
check('Concurrent same transition: exactly one success',race.filter(x=>x.ok).length===1);
check('Concurrent same transition: exactly one history row',(await get(0,'task_history','&task_id=eq.'+t.id)).length===2);
await forbiddenAt('in_progress');
await good(2,'change_task_status',{p_task_id:t.id,p_target_status:'review'});
await forbiddenAt('review');
for(const comment of [null,'',' \t\n']) await denied('Revision comment rejected: '+JSON.stringify(comment),0,'change_task_status',{p_task_id:t.id,p_target_status:'revision',p_comment:comment},'22023');
check('Failed revision leaves history unchanged',(await get(0,'task_history','&task_id=eq.'+t.id)).length===3);
await good(1,'change_task_status',{p_task_id:t.id,p_target_status:'revision',p_comment:'Исправить крепления'});
await forbiddenAt('revision');
await good(2,'change_task_status',{p_task_id:t.id,p_target_status:'in_progress'});
await good(2,'change_task_status',{p_task_id:t.id,p_target_status:'review'});
await good(0,'change_task_status',{p_task_id:t.id,p_target_status:'accepted'});
await forbiddenAt('accepted');
const history=await get(0,'task_history','&task_id=eq.'+t.id+'&order=created_at.asc,id.asc');
check('Full cycle has exactly seven history entries',history.length===7);
check('History author and initial null preserved',history[0].from_status===null&&history[0].changed_by===m1&&history[1].changed_by===e1&&history[3].changed_by===m2);
await good(0,'update_task',{p_task_id:t.id,p_title:'Монтаж освещения принят',p_description:'Готово',p_object_id:o.id,p_assignee_id:e2});
check('Old assignee loses task and history',(await get(2,'tasks','&id=eq.'+t.id)).length===0&&(await get(2,'task_history','&task_id=eq.'+t.id)).length===0);
check('New assignee receives complete history',(await get(3,'task_history','&task_id=eq.'+t.id)).length===7);
check('Editing preserves accepted status and author',(await get(0,'tasks','&id=eq.'+t.id))[0].status==='accepted'&&(await get(0,'tasks','&id=eq.'+t.id))[0].created_by===m1);
// Conflicting manager results must not both commit.
const conflict=await create('Временная проверка конкуренции');
await good(2,'change_task_status',{p_task_id:conflict.id,p_target_status:'in_progress'});await good(2,'change_task_status',{p_task_id:conflict.id,p_target_status:'review'});
const cr=await Promise.all([rpc(0,'change_task_status',{p_task_id:conflict.id,p_target_status:'accepted'}),rpc(1,'change_task_status',{p_task_id:conflict.id,p_target_status:'revision',p_comment:'Fix'})]);
check('Conflicting manager transitions: one commit',cr.filter(x=>x.ok).length===1);
check('Conflicting transitions: no duplicate history',(await get(0,'task_history','&task_id=eq.'+conflict.id)).length===4);
await good(0,'delete_task',{p_task_id:conflict.id});
await denied('Deleted task cannot change status',2,'change_task_status',{p_task_id:conflict.id,p_target_status:'in_progress'},'P0002');
const doomed=await good(0,'create_object',{p_name:'Временный удаляемый объект',p_address:'Тестовый адрес'});
const dt=await create('Временная удаляемая задача',e1,doomed.id);
await good(0,'delete_object',{p_object_id:doomed.id});
check('Deleted object hides tasks and history',(await get(0,'tasks','&id=eq.'+dt.id)).length===0&&(await get(2,'task_history','&task_id=eq.'+dt.id)).length===0);
await denied('Deleted parent forbids edits',0,'update_task',{p_task_id:dt.id,p_title:'Hack',p_description:'',p_object_id:o.id,p_assignee_id:e1},'P0002');
for(const table of ['profiles','objects','tasks','task_history']){const r=await req('/rest/v1/'+table+'?select=*',null);check('Anonymous read denied: '+table,!r.ok);}
const signup=await req('/auth/v1/signup',null,'POST',{email:'signup-probe@crm-demo.example.com',password:'Temporary-Signup-Probe-123!'});check('Open signup disabled',!signup.ok);
const metadata=await req('/auth/v1/user',sessions[2].access_token,'PUT',{data:{role:'manager'}});check('User metadata cannot elevate actual role',metadata.ok&&(await get(2,'profiles','&id=eq.'+e1))[0].role==='executor');
await denied('Metadata role does not grant manager RPC',2,'create_object',{p_name:'Hack',p_address:'Hack'},'42501');
// Final demo state, all histories created through normal RPC.
const progress=await create('Смонтировать ограждение');await good(2,'change_task_status',{p_task_id:progress.id,p_target_status:'in_progress'});
const review=await create('Проверить вентиляцию');await good(2,'change_task_status',{p_task_id:review.id,p_target_status:'in_progress'});await good(2,'change_task_status',{p_task_id:review.id,p_target_status:'review'});
const revision=await create('Устранить замечания к покраске',e2);await good(3,'change_task_status',{p_task_id:revision.id,p_target_status:'in_progress'});await good(3,'change_task_status',{p_task_id:revision.id,p_target_status:'review'});await good(0,'change_task_status',{p_task_id:revision.id,p_target_status:'revision',p_comment:'Прокрасить углы'});
check('Demo contains all five statuses',new Set((await get(0,'tasks')).map(t=>t.status)).size===5);
check('Demo has three active objects',(await get(0,'objects')).length===3);
for(let i=0;i<4;i++)await req('/auth/v1/logout',sessions[i].access_token,'POST');
fs.writeFileSync(new URL('docs/database-verification.json',root),JSON.stringify({verified_at:new Date().toISOString(),mode:'Hosted Auth + PostgREST, public key, four password sessions',passed:results.length,calls,results},null,2));
console.log(`COMPLETE: ${results.length} assertions, ${calls} real HTTP requests`);
}catch(e){console.error('FAIL:',e.message);process.exitCode=1;}
