// Контракт: docs/database-contract.md. Типы схемы генерирует агент 2.
export type Role = 'manager' | 'executor';
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'revision';
export interface Profile { id: string; full_name: string; role: Role }
export interface CrmObject { id: string; name: string; address: string; created_at: string; deleted_at: string | null }
export interface Task { id: string; title: string; description: string; object_id: string; assignee_id: string; status: TaskStatus; created_by: string; created_at: string; deleted_at: string | null }
export interface TaskHistory { id: string; task_id: string; from_status: TaskStatus | null; to_status: TaskStatus; changed_by: string; created_at: string; comment: string | null }
export const statusLabels: Record<TaskStatus, string> = { new: 'Новая', in_progress: 'В работе', review: 'На проверке', accepted: 'Принята', revision: 'На доработке' };
