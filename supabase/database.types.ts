export type AppRole = 'manager' | 'executor'
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'accepted' | 'revision'
export interface ProfileRow { id: string; full_name: string; role: AppRole }
export interface ObjectRow { id: string; name: string; address: string; created_at: string; deleted_at: string | null }
export interface TaskRow { id: string; title: string; description: string; object_id: string; assignee_id: string; status: TaskStatus; created_by: string; created_at: string; deleted_at: string | null }
export interface TaskHistoryRow { id: string; task_id: string; from_status: TaskStatus | null; to_status: TaskStatus; changed_by: string; created_at: string; comment: string | null }
type ReadTable<Row, Relationships extends { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] }[] = []> = { Row: Row; Insert: never; Update: never; Relationships: Relationships }
// Client writes must use RPC. Generated cloud types can replace this contract
// after migration application; never is deliberately stricter for table writes.
export interface Database {
 public: {
  Tables: {
   profiles: ReadTable<ProfileRow>
   objects: ReadTable<ObjectRow>
   tasks: ReadTable<TaskRow, [
    { foreignKeyName: 'tasks_object_id_fkey'; columns: ['object_id']; isOneToOne: false; referencedRelation: 'objects'; referencedColumns: ['id'] },
    { foreignKeyName: 'tasks_assignee_id_fkey'; columns: ['assignee_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
    { foreignKeyName: 'tasks_created_by_fkey'; columns: ['created_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
   ]>
   task_history: ReadTable<TaskHistoryRow, [
    { foreignKeyName: 'task_history_task_id_fkey'; columns: ['task_id']; isOneToOne: false; referencedRelation: 'tasks'; referencedColumns: ['id'] },
    { foreignKeyName: 'task_history_changed_by_fkey'; columns: ['changed_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
   ]>
  }
  Views: { [_ in never]: never }
  Functions: {
   create_object: { Args: { p_name: string; p_address: string }; Returns: ObjectRow }
   update_object: { Args: { p_object_id: string; p_name: string; p_address: string }; Returns: ObjectRow }
   delete_object: { Args: { p_object_id: string }; Returns: undefined }
   create_task: { Args: { p_title: string; p_description: string; p_object_id: string; p_assignee_id: string }; Returns: TaskRow }
   update_task: { Args: { p_task_id: string; p_title: string; p_description: string; p_object_id: string; p_assignee_id: string }; Returns: TaskRow }
   delete_task: { Args: { p_task_id: string }; Returns: undefined }
   change_task_status: { Args: { p_task_id: string; p_target_status: string; p_comment?: string | null }; Returns: TaskRow }
  }
  Enums: { app_role: AppRole; task_status: TaskStatus }
  CompositeTypes: { [_ in never]: never }
 }
}
