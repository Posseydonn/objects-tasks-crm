import { useCallback, useState } from 'react';
import { Button, Input, Select, Typography } from 'antd';
import { useAuth } from '../auth/AuthProvider';

import { statusLabels } from '../types/domain';
import type { TaskStatus } from '../types/domain';
import { PageHeader, profileNames, ResourceState, screenReads, TasksTable, useResource } from './crm/shared';

export function MyTasksPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [status, setStatus] = useState<TaskStatus>();
  const [search, setSearch] = useState('');
  const load = useCallback(async (signal: AbortSignal) => {
    const read = screenReads(signal);
    const [profile, visibleTasks, objects] = await Promise.all([read.profile(userId), read.tasks(), read.objects()]);
    const tasks = visibleTasks.filter(task => task.assignee_id === userId);
    const names = await profileNames(tasks.map(task => task.assignee_id), signal);
    return { profile, tasks, objects, names };
  }, [userId]);
  const resource = useResource(userId, load);
  const data = resource.data;
  const query = search.trim().toLocaleLowerCase('ru');
  return <div className="crm-page"><PageHeader title="Мои задачи" subtitle="Задачи, назначенные вам" actions={<Button onClick={resource.reload} disabled={resource.loading}>Обновить</Button>} />
    <ResourceState {...resource} retry={resource.reload}>{data && <div className="crm-panel">
      {data.profile.role === 'manager' && <Typography.Paragraph type="secondary">Постановщик управляет задачами в разделе «Объекты». Назначать задачи можно исполнителям.</Typography.Paragraph>}
      <div className="crm-toolbar"><Input.Search aria-label="Поиск задач" placeholder="Название задачи" allowClear value={search} onChange={event => setSearch(event.target.value)} />
        <Select className="crm-status-filter" aria-label="Фильтр по статусу" placeholder="Все статусы" allowClear value={status} onChange={setStatus} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
      </div>
      <TasksTable tasks={data.tasks.filter(task => (!status || task.status === status) && task.title.toLocaleLowerCase('ru').includes(query))} names={data.names} objects={data.objects}
        emptyText={status || query ? 'По этим условиям задач нет. Измените фильтры.' : 'Вам пока не назначены задачи.'} />
    </div>}</ResourceState></div>;
}
