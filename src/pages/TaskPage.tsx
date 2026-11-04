import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Breadcrumb, Button, Descriptions, Empty, Popconfirm, Space, Timeline, Typography } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthProvider';
import { statusLabels } from '../types/domain';
import type { TaskStatus } from '../types/domain';
import { RevisionForm, TaskForm } from './crm/forms';
import { formatDate, isManager, PageHeader, profileNames, ResourceState, screenReads, StatusTag, useResource } from './crm/shared';

export function TaskPage() {
  const { taskId = '' } = useParams();
  return <TaskScreen key={taskId} taskId={taskId} />;
}
function TaskScreen({ taskId }: { taskId: string }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const navigate = useNavigate();
  const load = useCallback(async (signal: AbortSignal) => {
    const read = screenReads(signal);
    const [profile, task] = await Promise.all([read.profile(userId), read.task(taskId)]);
    const [object, history, executors, objects] = await Promise.all([
      read.object(task.object_id), read.history(taskId),
      isManager(profile) ? read.executors() : Promise.resolve([]),
      isManager(profile) ? read.objects() : Promise.resolve([]),
    ]);
    const names = await profileNames([task.assignee_id, task.created_by, ...history.map(entry => entry.changed_by)], signal);
    return { profile, task, object, history, names, executors, objects };
  }, [taskId, userId]);
  const resource = useResource(`${userId}:${taskId}`, load);
  const data = resource.data;
  const [form, setForm] = useState<'edit' | 'revision'>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function action(target?: TaskStatus) {
    if (lock.current || !data) return;
    lock.current = true; setBusy(true); setActionError(undefined);
    try {
      if (target) await api.changeStatus(taskId, target);
      else await api.deleteTask(taskId);
      if (alive.current) {
        if (target) resource.reload();
        else navigate(`/objects/${data.task.object_id}`, { replace: true });
      }
    } catch (failure) {
      if (alive.current) { setActionError(errorMessage(failure)); resource.reload(); }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const task = data?.task;
  const manager = isManager(data?.profile);
  const assigned = data?.profile.role === 'executor' && task?.assignee_id === userId;
  return <div className="crm-page"><Breadcrumb className="crm-breadcrumb" items={[
    { title: <Link to="/objects">Объекты</Link> },
    ...(data ? [{ title: <Link to={`/objects/${data.object.id}`}>{data.object.name}</Link> }] : []),
    { title: 'Карточка задачи' },
  ]} /><ResourceState {...resource} retry={resource.reload}>{data && task && <>
    <PageHeader title={task.title} subtitle={<StatusTag status={task.status} />} actions={<>
      <Button onClick={resource.reload} disabled={busy}>Обновить</Button>
      {manager && <><Button disabled={busy} onClick={() => setForm('edit')}>Редактировать</Button>
        <Popconfirm title="Удалить задачу?" description="Задача будет скрыта. История сохранится." okText="Удалить" cancelText="Отмена" disabled={busy} onConfirm={() => action()}>
          <Button danger loading={busy}>Удалить задачу</Button></Popconfirm></>}
    </>} />
    {actionError && <Alert className="notice" type="error" showIcon title={actionError} />}
    <div className="crm-panel"><Space wrap>
      {assigned && (task.status === 'new' || task.status === 'revision') && <Button type="primary" loading={busy} onClick={() => void action('in_progress')}>{task.status === 'revision' ? 'Продолжить работу' : 'Взять в работу'}</Button>}
      {assigned && task.status === 'in_progress' && <Button type="primary" loading={busy} onClick={() => void action('review')}>Отправить на проверку</Button>}
      {manager && task.status === 'review' && <><Button type="primary" loading={busy} onClick={() => void action('accepted')}>Принять задачу</Button><Button disabled={busy} onClick={() => setForm('revision')}>Вернуть на доработку</Button></>}
      {task.status === 'accepted' && <Typography.Text type="secondary">Задача принята.</Typography.Text>}
      {manager && ['new', 'in_progress', 'revision'].includes(task.status) && <Typography.Text type="secondary">Следующее действие — за исполнителем.</Typography.Text>}
      {assigned && task.status === 'review' && <Typography.Text type="secondary">Ожидает решения постановщика.</Typography.Text>}
    </Space></div>
    <div className="crm-details"><div className="crm-panel"><Typography.Title level={4}>Данные задачи</Typography.Title>
      <Descriptions column={1} items={[
        { key: 'description', label: 'Описание', children: <span className="crm-text">{task.description || 'Описание не добавлено'}</span> },
        { key: 'object', label: 'Объект', children: <Link to={`/objects/${data.object.id}`}>{data.object.name}</Link> },
        { key: 'address', label: 'Адрес', children: data.object.address },
        { key: 'assignee', label: 'Исполнитель', children: data.names[task.assignee_id] },
        { key: 'author', label: 'Автор', children: data.names[task.created_by] },
        { key: 'created', label: 'Создана', children: formatDate(task.created_at) },
      ]} /></div>
      <div className="crm-panel"><Typography.Title level={4}>История статусов</Typography.Title>
        {data.history.length ? <Timeline className="crm-timeline" items={data.history.map(entry => ({
          key: entry.id, color: entry.to_status === 'accepted' ? 'green' : 'blue',
          content: <div><Typography.Text strong>{entry.from_status ? `${statusLabels[entry.from_status]} → ${statusLabels[entry.to_status]}` : `Создана → ${statusLabels[entry.to_status]}`}</Typography.Text>
            <span className="crm-history-meta">{data.names[entry.changed_by]} · {formatDate(entry.created_at)}</span>
            {entry.comment && <p className="crm-history-comment crm-text">{entry.comment}</p>}</div>,
        }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="История пока пуста" />}
      </div></div>
    {form === 'edit' && manager && <TaskForm task={task} objects={data.objects} executors={data.executors} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); resource.reload(); }} />}
    {form === 'revision' && manager && <RevisionForm taskId={taskId} onClose={() => setForm(undefined)} onSaved={() => { setForm(undefined); resource.reload(); }} />}
  </>}</ResourceState></div>;
}
