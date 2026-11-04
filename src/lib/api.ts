import { supabase } from './supabase';
import type { CrmObject, Profile, Task, TaskHistory, TaskStatus } from '../types/domain';
function client() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
function unwrap<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error) throw error;
  if (data === null || data === undefined) throw { code: 'P0002' };
  return data;
}
export const api = {
  async profile(userId: string): Promise<Profile> { return unwrap(await client().from('profiles').select('*').eq('id', userId).single()); },
  async executors(): Promise<Profile[]> { return unwrap(await client().from('profiles').select('*').eq('role', 'executor').order('full_name')); },
  async objects(): Promise<CrmObject[]> { return unwrap(await client().from('objects').select('*').is('deleted_at', null).order('created_at', { ascending: false })); },
  async object(id: string): Promise<CrmObject> { return unwrap(await client().from('objects').select('*').eq('id', id).is('deleted_at', null).single()); },
  async tasks(objectId?: string): Promise<Task[]> {
    let query = client().from('tasks').select('*').is('deleted_at', null);
    if (objectId) query = query.eq('object_id', objectId);
    return unwrap(await query.order('created_at', { ascending: false }));
  },
  async task(id: string): Promise<Task> { return unwrap(await client().from('tasks').select('*').eq('id', id).is('deleted_at', null).single()); },
  async history(id: string): Promise<TaskHistory[]> { return unwrap(await client().from('task_history').select('*').eq('task_id', id).order('created_at').order('id')); },
  async createObject(name: string, address: string): Promise<CrmObject> { return unwrap(await client().rpc('create_object', { p_name: name, p_address: address })); },
  async updateObject(id: string, name: string, address: string): Promise<CrmObject> { return unwrap(await client().rpc('update_object', { p_object_id: id, p_name: name, p_address: address })); },
  async deleteObject(id: string): Promise<void> { const { error } = await client().rpc('delete_object', { p_object_id: id }); if (error) throw error; },
  async createTask(task: Pick<Task, 'title' | 'description' | 'object_id' | 'assignee_id'>): Promise<Task> { return unwrap(await client().rpc('create_task', { p_title: task.title, p_description: task.description, p_object_id: task.object_id, p_assignee_id: task.assignee_id })); },
  async updateTask(id: string, task: Pick<Task, 'title' | 'description' | 'object_id' | 'assignee_id'>): Promise<Task> { return unwrap(await client().rpc('update_task', { p_task_id: id, p_title: task.title, p_description: task.description, p_object_id: task.object_id, p_assignee_id: task.assignee_id })); },
  async deleteTask(id: string): Promise<void> { const { error } = await client().rpc('delete_task', { p_task_id: id }); if (error) throw error; },
  async changeStatus(id: string, status: TaskStatus, comment: string | null = null): Promise<Task> { return unwrap(await client().rpc('change_task_status', { p_task_id: id, p_target_status: status, p_comment: comment })); },
};
