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

Актуализация 2026-11-04 23:20 МСК: обе миграции успешно применены в облаке. RLS и гранты проверены SQL; security advisors выполнены. Служебный RPC rls_auto_enable закрыт. Сгенерированные облачные типы сверены; ручной контракт сохраняет более строгие Insert/Update=never. Auth-пользователей пока 0; реальные REST/Auth и конкурентные сценарии остаются до создания тестовых пользователей через Auth Admin/Dashboard.

Приёмка 2026-11-04: настоящие password-входы и REST-проверки 4 аккаунтов, 91 проверка / 131 запрос, включая конкуренцию, пройдены. Демо: 3 объекта / 6 задач / все 5 статусов. Отчёт docs/database-verification.json; скрипт supabase/tests/hosted-security.mjs (создаёт данные, запускать только на подготовленной пустой базе). Доступы .crm-test-access.json.local вне Git. Этап БД завершён; UI и публикация проходят отдельную приёмку. Ограничения advisors описаны в progress.md.

Финальный результат: 97 успешных проверок (91 основной сценарий + 6 дополнительных), см. docs/database-verification.json. Доступы объединены в один .crm-test-access.json.local вне Git. Дополнительная безопасная повторная проверка: supabase/tests/hosted-followup.ps1.

Воспроизводимость: имена миграций согласованы с облачной историей (20261104201811 / 20261104201920), вторая миграция допускает отсутствие платформенной функции. Инструкция чистого SQL-запуска: supabase/tests/README.md. Облако повторно не мигрировалось.
