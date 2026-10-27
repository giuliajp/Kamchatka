import { useId, type ReactNode } from 'react';
import { Card, Div, Spacing, Text, Title } from '@vkontakte/vkui';

export interface InfoCardProps {
  title: string;
  children: ReactNode;
}

export function InfoCard({ title, children }: InfoCardProps) {
  const headingId = useId();
  return (
    <Card Component="article" mode="outline" aria-labelledby={headingId}>
      <Div>
        <Title level="3" Component="h3" id={headingId}>{title}</Title>
        <Spacing size={12} />
        <Text Component="div">{children}</Text>
      </Div>
    </Card>
  );
}
