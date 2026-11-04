import { useCallback, useState } from 'react';
import { Button, Empty, Input, Table } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

import type { CrmObject } from '../types/domain';
import { ObjectForm } from './crm/forms';
import { formatDate, isManager, PageHeader, ResourceState, screenReads, useResource } from './crm/shared';

export function ObjectsPage() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const load = useCallback(async (signal: AbortSignal) => {
    const read = screenReads(signal);
    const [profile, objects] = await Promise.all([read.profile(userId), read.objects()]);
    return { profile, objects };
  }, [userId]);
  const resource = useResource(userId, load);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const data = resource.data;
  const query = search.trim().toLocaleLowerCase('ru');
  return <div className="crm-page"><PageHeader title="Объекты" subtitle="Стройки и задачи по ним" actions={<>
    <Button icon={<ReloadOutlined />} onClick={resource.reload} disabled={resource.loading}>Обновить</Button>
    {isManager(data?.profile) && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Новый объект</Button>}
  </>} /><ResourceState {...resource} retry={resource.reload}>
    {data && <div className="crm-panel"><div className="crm-toolbar"><Input.Search aria-label="Поиск объектов" placeholder="Название или адрес" allowClear value={search} onChange={event => setSearch(event.target.value)} /></div>
      <Table<CrmObject> rowKey="id" dataSource={data.objects.filter(object => `${object.name} ${object.address}`.toLocaleLowerCase('ru').includes(query))}
        scroll={{ x: 520 }} pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? 'Ничего не найдено. Измените поиск.' : isManager(data.profile) ? 'Объектов пока нет. Создайте первый объект.' : 'Пока нет объектов с назначенными вам задачами.'} /> }}
        columns={[
          { title: 'Название', dataIndex: 'name', render: (name: string, object: CrmObject) => <Link to={`/objects/${object.id}`}>{name}</Link> },
          { title: 'Адрес', dataIndex: 'address' },
          { title: 'Создан', dataIndex: 'created_at', render: formatDate },
        ]} /></div>}
    {creating && isManager(data?.profile) && <ObjectForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); resource.reload(); }} />}
  </ResourceState></div>;
}
