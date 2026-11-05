// No credentials in source, screenshots, traces, or output. Run only on a demo project.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const root = process.env.CRM_BASE_URL || 'http://127.0.0.1:5173';
let accounts;
try { ({accounts} = JSON.parse((await readFile(process.env.CRM_ACCESS_FILE || '.crm-test-access.json.local', 'utf8')).replace(/^\uFEFF/, ''))); }
catch { throw new Error('Cannot read access file; expected accounts array'); }
const manager = accounts.find(a => a.role === 'manager');
const executors = accounts.filter(a => a.role === 'executor').slice(0, 2);
assert(manager && executors.length === 2, 'Need one manager and two executors');
const env = Object.fromEntries((await readFile('.env.local', 'utf8')).replace(/^\uFEFF/, '').split(/\r?\n/)
  .filter(l => /^VITE_SUPABASE_\w+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const auth = await db.auth.signInWithPassword({email: manager.email, password: manager.password});
assert(!auth.error, 'Manager API login failed');
async function rows(table) {
  const result = [];
  for (;;) {
    let q = db.from(table).select('*').order('id').limit(500);
    if (table !== 'task_history') q = q.is('deleted_at', null);
    if (result.length) q = q.gt('id', result.at(-1).id);
    const {data, error} = await q;
    assert(!error, `Read failed: ${table}`);
    if (!data.length) return result;
    result.push(...data);
  }
}
async function snapshot() { return Object.fromEntries(await Promise.all(['objects','tasks','task_history'].map(async t=>[t,await rows(t)]))); }
const before = await snapshot();
const browser = await chromium.launch({ headless: !args.has('--headed'),
  ...(process.env.CRM_BROWSER_PATH ? {executablePath:process.env.CRM_BROWSER_PATH} : {}),
  ...(process.env.CRM_PROXY ? {proxy:{server:process.env.CRM_PROXY,bypass:'127.0.0.1,localhost'}} : {}) });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(60000);
const button = name => page.getByRole('button',{name,exact:true});
const heading = name => page.getByRole('heading',{name,exact:true});
async function login(account) {
  if (await button('Выйти').count()) await button('Выйти').click();
  else await page.goto(root+'/login');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill(account.email);
  await page.getByRole('textbox',{name:'Пароль',exact:true}).fill(account.password);
  await button('Войти').click();
  await page.getByRole('banner').getByText(account.email,{exact:true}).waitFor();
}
async function unavailable(url) {
  await page.goto(url);
  await page.getByRole('alert').filter({hasText:'Недоступна или не найдена.'}).waitFor();
}
async function save() { await button('Сохранить').click(); await page.getByRole('dialog').waitFor({state:'hidden'}); }
let temporaryObject;
let temporaryName;
let failure = false;
try {
  await page.goto(root+'/my-tasks'); await button('Войти').waitFor();
  await login(manager); await page.goto(root+'/objects'); await page.locator('.crm-panel').waitFor();
  console.log('PASS anonymous route and manager login');
  for (const account of executors) {
    const own = before.tasks.filter(t => t.assignee_id === account.id);
    const foreign = before.tasks.find(t => t.assignee_id !== account.id);
    await login(account); await page.getByRole('link',{name:'Мои задачи',exact:true}).click();
    await page.locator('.crm-panel').waitFor();
    for (const t of own.slice(0, 5)) {
      await page.getByRole('searchbox',{name:'Поиск задач'}).fill(t.title);
      await page.getByRole('link',{name:t.title,exact:true}).waitFor();
    }
    if (foreign) await unavailable(root+'/tasks/'+foreign.id);
    const foreignObject = before.objects.find(o => !own.some(t => t.object_id === o.id));
    if (foreignObject) await unavailable(root+'/objects/'+foreignObject.id);
    if (own.length) {
      await page.goto(root+'/tasks/'+own[0].id); await heading(own[0].title).waitFor();
      await heading('История статусов').waitFor(); assert.equal(await button('Редактировать').count(),0);
    }
  }
  console.log('PASS both executors, foreign routes and history UI');
  if (write) {
    await login(manager); await page.goto(root+'/objects');
    await page.getByRole('button',{name:'Новый объект'}).click();
    const name = 'Приёмка '+crypto.randomUUID();
    temporaryName = name;
    await page.getByRole('textbox',{name:/Название/}).fill(name);
    await page.getByRole('textbox',{name:/Адрес/}).fill('Тестовый адрес'); await save();
    // Discover only this run's object, including a committed creation with lost response.
    temporaryObject = (await rows('objects')).find(o=>o.name===name)?.id;
    assert(temporaryObject, 'Created object missing');
    await page.getByRole('link',{name,exact:true}).click(); await heading(name).waitFor();
    await button('Редактировать').click(); await page.getByRole('textbox',{name:/Адрес/}).fill('Изменённый адрес'); await save();
    await page.getByText('Изменённый адрес',{exact:true}).waitFor();
    const title = 'Задача '+crypto.randomUUID();
    await button('Новая задача').click(); await page.getByRole('textbox',{name:/Название/}).fill(title);
    await page.getByRole('textbox',{name:'Описание',exact:true}).fill('Проверка создания');
    await page.getByRole('combobox',{name:/Исполнитель/}).click(); await page.getByText(executors[0].full_name,{exact:true}).click(); await save();
    await page.getByRole('link',{name:title,exact:true}).click();await heading(title).waitFor();const taskUrl=page.url();
    await button('Редактировать').click();await page.getByRole('textbox',{name:'Описание',exact:true}).fill('Проверка редактирования');
    await page.getByRole('combobox',{name:/Исполнитель/}).click();await page.getByText(executors[1].full_name,{exact:true}).click();await save();
    await page.getByText('Проверка редактирования',{exact:true}).waitFor();
    await login(executors[0]);await unavailable(taskUrl);
    await login(executors[1]);await page.goto(taskUrl);await button('Взять в работу').click();
    await button('Отправить на проверку').click();await page.getByText('Ожидает решения постановщика.',{exact:true}).waitFor();
    await login(manager);await page.goto(taskUrl);await button('Вернуть на доработку').click();
    const comment=page.getByRole('textbox',{name:/Что нужно исправить/});await comment.fill('   ');
    await page.getByRole('dialog').getByRole('button',{name:'Вернуть на доработку',exact:true}).click();
    await page.getByText('Заполните поле: одних пробелов недостаточно.',{exact:true}).waitFor();
    await comment.fill('Исправить результат');await page.getByRole('dialog').getByRole('button',{name:'Вернуть на доработку',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('Исправить результат',{exact:true}).waitFor();
    await login(executors[1]);await page.goto(taskUrl);await button('Продолжить работу').click();await button('Отправить на проверку').click();
    await page.getByText('Ожидает решения постановщика.',{exact:true}).waitFor();await login(manager);await page.goto(taskUrl);
    await button('Принять задачу').click();await page.getByText('Задача принята.',{exact:true}).waitFor();
    await page.reload();await page.getByText('Задача принята.',{exact:true}).waitFor();assert.equal(await page.locator('.crm-timeline li').count(),7);
    await button('Удалить задачу').click();await button('Удалить').click();await heading(name).waitFor();await unavailable(taskUrl);
    console.log('PASS create/edit/reassign/full cycle/comment/history/task deletion');
  }
  await login(executors[1]);await page.setViewportSize({width:390,height:844});await button('Открыть меню').click();
  await page.getByRole('link',{name:'Мои задачи',exact:true}).click();await page.locator('.crm-panel').waitFor();
  await page.waitForFunction(()=>document.querySelector('#workspace-navigation').getBoundingClientRect().width===0);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS mobile navigation');
} catch {
  failure = true;
  // Playwright exceptions can contain filled values: never print raw exceptions.
  console.error('FAIL browser acceptance; inspect locally without recording credentials');
} finally {
  if (!temporaryObject && temporaryName) {
    try { temporaryObject = (await rows('objects')).find(o=>o.name===temporaryName)?.id; }
    catch { failure=true; console.error('FAIL cleanup discovery'); }
  }
  if (temporaryObject) {
    const {error} = await db.rpc('delete_object',{p_object_id:temporaryObject});
    if (error) {failure=true;console.error('FAIL cleanup; remove this run temporary object manually');}
    else console.log('PASS cleanup temporary object via checked RPC');
  }
  try { assert.deepEqual(await snapshot(),before);console.log('PASS original active data and visible history unchanged'); }
  catch {failure=true;console.error('FAIL baseline comparison');}
  await db.auth.signOut();await context.close();await browser.close();
}
if (failure) process.exitCode=1;
