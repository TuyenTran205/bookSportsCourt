import { DashboardShell } from '@/components/layout/DashboardShell';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="owner">{children}</DashboardShell>;
}
