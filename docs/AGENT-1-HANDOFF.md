# Основа для интеграции

Агент 1 владеет package.json, package-lock.json, vite.config.ts, tsconfig.json, vercel.json, src/App.tsx, src/main.tsx, src/auth, src/lib и общими типами.

Агент 3 создаёт экспортируемые компоненты экранов в src/pages или src/features. Маршруты уже зарезервированы: /login, /objects, /objects/:objectId, /tasks/:taskId, /my-tasks. Передайте имена экспортов интегратору для замены StagePlaceholder. Параметры маршрутов: objectId, taskId. Временные экраны явно помечены; вымышленные рабочие данные не подключены.

Авторизация: useAuth() из src/auth/AuthProvider.tsx возвращает session, loading, error, signOut(). Клиент: supabase из src/lib/supabase.ts (nullable при отсутствующей конфигурации). Общий обработчик: errorMessage(unknown) из src/lib/errors.ts. Уведомления: App.useApp() из antd. Пользовательская часть Outlet перемонтируется при смене user.id, поэтому данные предыдущего аккаунта не сохраняются в локальном состоянии экранов. Асинхронные запросы экранов должны отменяться при размонтировании.

Контракт агента 2 получен: docs/database-contract.md. Типизированный клиент использует supabase/database.types.ts; общие модели доступны в src/types/domain.ts, функции запросов в src/lib/api.ts (api.profile, executors, objects, object, tasks, task, history, createObject, updateObject, deleteObject, createTask, updateTask, deleteTask, changeStatus). Роль нельзя брать из user_metadata. База проверяет права независимо от интерфейса. Supabase-схему агент 1 не изменяет.

Для запуска: npm ci, скопировать .env.example в .env.local и заполнить публичные настройки, npm run dev. Для проверки: npm run build. В браузер передаётся только publishable key; service_role не использовать.

Vercel: framework Vite, build npm run build, output dist. Переменные VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY задаются до сборки в настройках проекта. vercel.json содержит SPA fallback для прямых ссылок.

## Проверенный результат этапа A
Сайт: https://objects-tasks-crm-six.vercel.app. Репозиторий: https://github.com/Posseydonn/objects-tasks-crm (приватный). npm ci и npm run build проходят локально и на Vercel. Публичные переменные окружения сохранены в production.
В браузере проверены вход постановщиком и исполнителем, выход, сохранение сессии после reload, возврат на исходную прямую ссылку. Четыре тестовых аккаунта проверены через Auth API. Секретные тестовые доступы остаются только в игнорируемом локальном файле. Экраны CRM ещё не подключены; этап A не означает готовность MVP.
