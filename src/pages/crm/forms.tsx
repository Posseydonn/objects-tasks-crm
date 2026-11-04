import { useEffect, useRef, useState } from 'react';
import { Alert, Form, Input, Modal, Select } from 'antd';
import { api } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import type { CrmObject, Profile, Task } from '../../types/domain';

const required = [{ required: true, whitespace: true, message: 'Заполните поле: одних пробелов недостаточно.' }];

function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(action: () => Promise<unknown>, done: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try { await action(); if (alive.current) done(); }
    catch (failure) { if (alive.current) setError(errorMessage(failure)); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return { busy, error, save };
}

export function ObjectForm({ object, onClose, onSaved }: { object?: CrmObject; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm<{ name: string; address: string }>();
  const { busy, error, save } = useSave();
  return <Modal open title={object ? 'Редактировать объект' : 'Новый объект'} okText="Сохранить" cancelText="Отмена"
    confirmLoading={busy} closable={!busy} maskClosable={!busy} keyboard={!busy} cancelButtonProps={{ disabled: busy }}
    onCancel={onClose} onOk={() => form.submit()}>
    {error && <Alert className="notice" type="error" showIcon title={error} />}
    <Form form={form} layout="vertical" disabled={busy} initialValues={object} onFinish={values => void save(
      () => object ? api.updateObject(object.id, values.name.trim(), values.address.trim()) : api.createObject(values.name.trim(), values.address.trim()), onSaved)}>
      <Form.Item name="name" label="Название" rules={required}><Input autoFocus /></Form.Item>
      <Form.Item name="address" label="Адрес" rules={required}><Input /></Form.Item>
    </Form>
  </Modal>;
}

export function TaskForm({ task, objectId, objects, executors, onClose, onSaved }: {
  task?: Task; objectId?: string; objects: CrmObject[]; executors: Profile[]; onClose: () => void; onSaved: () => void;
}) {
  const [form] = Form.useForm<Pick<Task, 'title' | 'description' | 'object_id' | 'assignee_id'>>();
  const { busy, error, save } = useSave();
  return <Modal open title={task ? 'Редактировать задачу' : 'Новая задача'} okText="Сохранить" cancelText="Отмена"
    confirmLoading={busy} closable={!busy} maskClosable={!busy} keyboard={!busy} cancelButtonProps={{ disabled: busy }}
    onCancel={onClose} onOk={() => form.submit()}>
    {error && <Alert className="notice" type="error" showIcon title={error} />}
    {!executors.length && <Alert className="notice" type="warning" title="Нет доступных исполнителей. Обратитесь к администратору." />}
    <Form form={form} layout="vertical" disabled={busy} initialValues={task ?? { object_id: objectId, description: '' }}
      onFinish={values => void save(() => {
        const input = { ...values, title: values.title.trim(), description: values.description ?? '' };
        return task ? api.updateTask(task.id, input) : api.createTask(input);
      }, onSaved)}>
      <Form.Item name="title" label="Название" rules={required}><Input autoFocus /></Form.Item>
      <Form.Item name="description" label="Описание"><Input.TextArea rows={4} /></Form.Item>
      <Form.Item name="object_id" label="Объект" rules={[{ required: true, message: 'Выберите объект.' }]}>
        <Select showSearch optionFilterProp="label" options={objects.map(object => ({ value: object.id, label: object.name }))} />
      </Form.Item>
      <Form.Item name="assignee_id" label="Исполнитель" rules={[{ required: true, message: 'Выберите исполнителя.' }]}>
        <Select showSearch optionFilterProp="label" options={executors.map(person => ({ value: person.id, label: person.full_name }))} />
      </Form.Item>
    </Form>
  </Modal>;
}

export function RevisionForm({ taskId, onClose, onSaved }: { taskId: string; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm<{ comment: string }>();
  const { busy, error, save } = useSave();
  return <Modal open title="Вернуть на доработку" okText="Вернуть на доработку" cancelText="Отмена"
    confirmLoading={busy} closable={!busy} maskClosable={!busy} keyboard={!busy} cancelButtonProps={{ disabled: busy }}
    onCancel={onClose} onOk={() => form.submit()}>
    {error && <Alert className="notice" type="error" showIcon title={error} />}
    <Form form={form} layout="vertical" disabled={busy} onFinish={values => void save(() => api.changeStatus(taskId, 'revision', values.comment.trim()), onSaved)}>
      <Form.Item name="comment" label="Что нужно исправить" rules={required}><Input.TextArea rows={4} autoFocus /></Form.Item>
    </Form>
  </Modal>;
}
