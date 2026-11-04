import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Empty, Space, Spin, Table, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { errorMessage } from '../../lib/errors';
import { statusLabels } from '../../types/domain';
import type { CrmObject, Profile, Task, TaskStatus } from '../../types/domain';
import './crm.css';

// The shared API has no signal parameter; this read-only adapter cancels screen
// requests without changing the integrator's API or database contract.
export function screenReads(signal: AbortSignal) {
  const client = supabase;
  if (!client) throw new Error('Supabase is not configured');
  function unwrap<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
    if (error) throw error;
    if (data == null) throw { code: 'P0002' };
    return data;
  }
  return {
    profile: async (id: string) => unwrap(await client.from('profiles').select('*').eq('id', id).abortSignal(signal).single()),
    executors: async () => unwrap(await client.from('profiles').select('*').eq('role', 'executor').order('full_name').abortSignal(signal)),
    objects: async () => unwrap(await client.from('objects').select('*').is('deleted_at', null).order('created_at', { ascending: false }).abortSignal(signal)),
    object: async (id: string) => unwrap(await client.from('objects').select('*').eq('id', id).is('deleted_at', null).abortSignal(signal).single()),
    tasks: async (objectId?: string) => {
      let query = client.from('tasks').select('*').is('deleted_at', null);
      if (objectId) query = query.eq('object_id', objectId);
      return unwrap(await query.order('created_at', { ascending: false }).abortSignal(signal));
    },
    task: async (id: string) => unwrap(await client.from('tasks').select('*').eq('id', id).is('deleted_at', null).abortSignal(signal).single()),
    history: async (id: string) => unwrap(await client.from('task_history').select('*').eq('task_id', id).order('created_at').order('id').abortSignal(signal)),
  };
}

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; revision: number; data?: T; error?: string }>({ key, revision: -1 });
  const generation = useRef(0);
  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    void load(controller.signal).then(data => {
      if (generation.current === current) setState({ key, revision, data });
    }).catch((failure: unknown) => {
      if (generation.current === current) setState({ key, revision, error: errorMessage(failure) });
    });
    return () => { generation.current++; controller.abort(); };
  }, [key, revision, load]);
  const fresh = state.key === key && state.revision === revision;
  return { data: fresh ? state.data : undefined, error: fresh ? state.error : undefined, loading: !fresh,
    reload: () => setRevision(value => value + 1) };
}

export async function profileNames(ids: string[], signal: AbortSignal): Promise<Record<string, string>> {
  const profiles = await Promise.all([...new Set(ids)].map(id => screenReads(signal).profile(id)));
  return Object.fromEntries(profiles.map(profile => [profile.id, profile.full_name]));
}

export function ResourceState({ loading, error, retry, children }: {
  loading: boolean; error?: string; retry: () => void; children: ReactNode;
}) {
  if (loading) return <div className="crm-loading" role="status"><Spin /><span>Загружаем данные…</span></div>;
  if (error) return <Alert type="error" showIcon title={error} action={<Button onClick={retry}>Повторить</Button>} />;
  return <>{children}</>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return <header className="crm-heading"><div><Typography.Title level={2}>{title}</Typography.Title>
    {subtitle && <Typography.Paragraph type="secondary">{subtitle}</Typography.Paragraph>}</div>
    <Space wrap>{actions}</Space></header>;
}

export const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const colors: Record<TaskStatus, string> = { new: 'default', in_progress: 'blue', review: 'gold', accepted: 'green', revision: 'volcano' };
export function StatusTag({ status }: { status: TaskStatus }) { return <Tag color={colors[status]}>{statusLabels[status]}</Tag>; }

export function TasksTable({ tasks, names, objects, emptyText = 'В этом объекте пока нет задач.' }: {
  tasks: Task[]; names: Record<string, string>; objects?: CrmObject[]; emptyText?: string;
}) {
  return <Table<Task> rowKey="id" dataSource={tasks} scroll={{ x: 680 }}
    pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} /> }}
    columns={[
      { title: 'Задача', dataIndex: 'title', render: (title: string, task: Task) => <Link to={`/tasks/${task.id}`}>{title}</Link> },
      ...(objects ? [{ title: 'Объект', key: 'object', render: (_: unknown, task: Task) => <Link to={`/objects/${task.object_id}`}>{objects.find(object => object.id === task.object_id)?.name ?? 'Открыть объект'}</Link> }] : []),
      { title: 'Статус', dataIndex: 'status', render: (status: TaskStatus) => <StatusTag status={status} /> },
      { title: 'Исполнитель', dataIndex: 'assignee_id', render: (id: string) => names[id] ?? 'Профиль недоступен' },
      { title: 'Создана', dataIndex: 'created_at', render: formatDate },
    ]} />;
}

export function isManager(profile?: Profile) { return profile?.role === 'manager'; }
