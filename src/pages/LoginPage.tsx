import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { errorMessage } from '../lib/errors';
export function LoginPage() {
  const { session } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from: unknown = location.state?.from;
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : '/objects';
  if (session) return <Navigate to={destination} replace />;
  async function submit(values: { email: string; password: string }) {
    if (!supabase) return;
    setBusy(true); setError(null);
    try {
      const { error: failure } = await supabase.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
      if (failure) throw failure;
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <main className="login"><Card className="login-card">
    <Typography.Text type="secondary">МИНИ-CRM · СТРОИТЕЛЬНЫЕ ОБЪЕКТЫ</Typography.Text>
    <Typography.Title level={2}>Объекты и задачи</Typography.Title>
    <Typography.Paragraph type="secondary">Войдите в рабочее пространство</Typography.Paragraph>
    {error && <Alert role="alert" type="error" title={error} className="notice" />}
    <Form layout="vertical" onFinish={submit} requiredMark={false} disabled={busy}>
      <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Проверьте email' }]}><Input autoComplete="username" type="email" size="large" /></Form.Item>
      <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}><Input.Password autoComplete="current-password" size="large" /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={busy}>Войти</Button>
    </Form>
    <Typography.Paragraph type="secondary" className="login-help">Доступ выдаёт администратор компании.</Typography.Paragraph>
  </Card></main>;
}
