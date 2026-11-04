import { useState } from 'react';
import { Alert, App as AntApp, Button, Layout, Menu, Result, Spin, Typography } from 'antd';
import { ApartmentOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { configurationError } from './lib/supabase';
import { errorMessage } from './lib/errors';
import { LoginPage } from './pages/LoginPage';
import { StagePlaceholder } from './pages/StagePlaceholder';
function ProtectedLayout() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const [busy, setBusy] = useState(false);
  if (!session) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  async function logout() {
    setBusy(true);
    try { await signOut(); navigate('/login', { replace: true }); }
    catch (failure) { void message.error(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <Layout className="workspace">
    <Layout.Sider breakpoint="lg" collapsedWidth="0" theme="light"><div className="brand">Объекты и задачи</div><Menu mode="inline" selectedKeys={[location.pathname.startsWith('/my-tasks') ? '/my-tasks' : '/objects']} items={[
      { key: '/objects', icon: <ApartmentOutlined />, label: <Link to="/objects">Объекты</Link> },
      { key: '/my-tasks', icon: <CheckSquareOutlined />, label: <Link to="/my-tasks">Мои задачи</Link> },
    ]} /></Layout.Sider>
    <Layout><Layout.Header className="workspace-header"><Typography.Text ellipsis>{session.user.email}</Typography.Text><Button onClick={() => void logout()} loading={busy}>Выйти</Button></Layout.Header>
      <Layout.Content className="workspace-content"><div key={session.user.id}><Outlet /></div></Layout.Content></Layout>
  </Layout>;
}
export default function App() {
  const { loading, error } = useAuth();
  if (configurationError) return <Result status="warning" title="Подключение не настроено" subTitle={configurationError} />;
  if (loading) return <div className="loading"><Spin size="large" tip="Проверяем вход…"><div className="loading-inner" /></Spin></div>;
  if (error) return <Alert type="error" title={error} action={<Button onClick={() => window.location.reload()}>Повторить</Button>} />;
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedLayout />}>
      <Route index element={<Navigate to="/objects" replace />} />
      <Route path="objects" element={<StagePlaceholder title="Объекты" />} />
      <Route path="objects/:objectId" element={<StagePlaceholder title="Карточка объекта" />} />
      <Route path="tasks/:taskId" element={<StagePlaceholder title="Карточка задачи" />} />
      <Route path="my-tasks" element={<StagePlaceholder title="Мои задачи" />} />
    </Route>
    <Route path="*" element={<Result status="404" title="Страница не найдена" extra={<Link to="/">На главную</Link>} />} />
  </Routes>;
}
