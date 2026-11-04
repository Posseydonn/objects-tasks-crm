export function errorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'invalid_credentials') return 'Неверный email или пароль.';
  if (code === 'email_not_confirmed') return 'Email не подтверждён. Обратитесь к администратору.';
  if (code === 'over_request_rate_limit') return 'Слишком много попыток. Попробуйте позже.';
  if (code === '42501') return 'Недостаточно прав для этого действия.';
  if (code === 'PGRST116' || code === 'P0002') return 'Недоступна или не найдена.';
  if (code === '22023') {
    const detail = 'message' in (error as object) ? String((error as { message: unknown }).message) : '';
    if (detail.includes('COMMENT_REQUIRED')) return 'Для возврата на доработку нужен комментарий.';
    if (detail.includes('INVALID_TRANSITION')) return 'Статус уже изменился или переход недоступен. Обновите задачу.';
    if (detail.includes('INVALID_ASSIGNEE')) return 'Назначить задачу можно только исполнителю.';
    return 'Проверьте обязательные поля.';
  }
  if (error instanceof TypeError) return 'Не удалось подключиться. Проверьте интернет и повторите попытку.';
  return 'Не удалось выполнить запрос. Повторите попытку или обратитесь к администратору.';
}
