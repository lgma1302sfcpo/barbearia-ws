import type { Metadata } from 'next';
import AccessHistory from './access-history';

export const metadata: Metadata = {
  title: 'Últimos acessos | Controle de Repasses',
  robots: { index: false, follow: false },
};

export default function AccessPage() {
  return <AccessHistory />;
}
