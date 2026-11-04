import { Empty, Typography } from 'antd';
export function StagePlaceholder({ title }: { title: string }) {
  return <section><Typography.Title level={2}>{title}</Typography.Title><Empty description="Раздел подключается на следующем этапе разработки" /></section>;
}
