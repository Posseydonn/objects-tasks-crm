import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Breadcrumb, Button, Popconfirm } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import { ObjectForm, TaskForm } from './crm/forms';
import { isManager, PageHeader, profileNames, ResourceState, screenReads, TasksTable, useResource } from './crm/shared';

export function ObjectPage() {
  const { objectId = '' } = useParams();
  return <ObjectScreen key={objectId} objectId={objectId} />;
}
function ObjectScreen({ objectId }: { objectId: string }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const navigate = useNavigate();
  const load = useCallback(async (signal: AbortSignal) => {
    const read = screenReads(signal);
    const [profile, object, tasks] = await Promise.all([read.profile(userId), read.object(objectId), read.tasks(objectId)]);
    const [names, executors, objects] = await Promise.all([
      profileNames(tasks.map(task => task.assignee_id), signal),
      isManager(profile) ? read.executors() : Promise.resolve([]),
      isManager(profile) ? read.objects() : Promise.resolve([object]),
    ]);
    return { profile, object, tasks, names, executors, objects };
  }, [objectId, userId]);
  const resource = useResource(`${userId}:${objectId}`, load);
  const data = resource.data;
  const [form, setForm] = useState<'object' | 'task'>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setActionError(undefined);
    try { await api.deleteObject(objectId); if (alive.current) navigate('/objects', { replace: true }); }
    catch (failure) { if (alive.current) setActionError(errorMessage(failure)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="crm-page"><Breadcrumb className="crm-breadcrumb" items={[{ title: <Link to="/objects">Объекты</Link> }, { title: 'Карточка объекта' }]} />
    <ResourceState {...resource} retry={resource.reload}>{data && <>
      <PageHeader title={data.object.name} subtitle={data.object.address} actions={<>
        <Button onClick={resource.reload} disabled={busy}>Обновить</Button>
        {isManager(data.profile) && <><Button onClick={() => setForm('object')} disabled={busy}>Редактировать</Button>
          <Popconfirm title="Удалить объект?" description="Объект и все его задачи будут скрыты. История сохранится." okText="Удалить" cancelText="Отмена" onConfirm={remove} disabled={busy}>
            <Button danger loading={busy}>Удалить объект</Button></Popconfirm>
          <Button type="primary" onClick={() => setForm('task')} disabled={busy}>Новая задача</Button></>}
      </>} />
      {actionError && <Alert className="notice" type="error" showIcon title={actionError} />}
      <div className="crm-panel"><TasksTable tasks={data.tasks} names={data.names} /></div>
      {form === 'object' && isManager(data.profile) && <ObjectForm object={data.object} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); resource.reload(); }} />}
      {form === 'task' && isManager(data.profile) && <TaskForm objectId={objectId} objects={data.objects} executors={data.executors} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); resource.reload(); }} />}
    </>}</ResourceState></div>;
}
