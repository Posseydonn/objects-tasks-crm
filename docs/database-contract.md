# Контракт БД / RPC — агент 2

Фиксирован 2026-11-04. Таблицы читаются через Supabase select с RLS; запись только RPC.
Роли: `manager` (постановщик), `executor` (исполнитель).
Статусы: `new`, `in_progress`, `review`, `accepted`, `revision`.

Таблицы:
- profiles: id uuid (Auth), full_name text, role.
- objects: id uuid, name text, address text, created_at timestamptz, deleted_at timestamptz|null.
- tasks: id uuid, title text, description text, object_id uuid, assignee_id uuid, status, created_by uuid, created_at timestamptz, deleted_at timestamptz|null.
- task_history: id uuid, task_id uuid, from_status nullable, to_status, changed_by uuid, created_at timestamptz, comment text|null.

RPC (именованные аргументы обязательны; возвращают одну строку соответствующей таблицы, delete возвращает void):
- create_object(p_name text, p_address text) -> objects
- update_object(p_object_id uuid, p_name text, p_address text) -> objects
- delete_object(p_object_id uuid) -> void
- create_task(p_title text, p_description text, p_object_id uuid, p_assignee_id uuid) -> tasks
- update_task(p_task_id uuid, p_title text, p_description text, p_object_id uuid, p_assignee_id uuid) -> tasks
- delete_task(p_task_id uuid) -> void
- change_task_status(p_task_id uuid, p_target_status text, p_comment text default null) -> tasks

Профиль текущего пользователя: profiles.eq('id', session.user.id).single(). Исполнители: profiles.eq('role','executor') под постановщиком.
История: task_history.eq('task_id',id).order('created_at').order('id'). Для имён можно читать связанные profiles через FK (без email и Auth metadata). Профиль содержит только безопасные поля.

Ошибки SQLSTATE: 42501 FORBIDDEN (роль/действие), P0002 NOT_FOUND (недоступна/не найдена), 22023 INVALID_INPUT / INVALID_TRANSITION / COMMENT_REQUIRED / INVALID_ASSIGNEE. Не выводить сырую БД-ошибку пользователю; преобразовать в русский текст.

После действий перечитать данные. Переназначение сохраняет статус; удаление объекта скрывает все задачи. Роль назначается только администратором после создания пользователя через Auth Admin/Dashboard. Автопрофиля/саморегистрации нет.

Статус 2026-11-04: 26 локальных проверок PGlite пройдены. Облачное применение не подтверждено (транспортная ошибка MCP). Типы supabase/database.types.ts написаны вручную; после применения сверить с generate_typescript_types. REST/Auth, advisors и конкурентные транзакции ещё не проверены.
