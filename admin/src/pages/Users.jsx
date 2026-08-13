import UsersPanel from '../components/UsersPanel';
import PageHeader from '../components/PageHeader';

export default function Users() {
  return (
    <div>
      <PageHeader title="ผู้ใช้งาน" subtitle="จัดการผู้ใช้และสิทธิ์การเข้าถึงระบบ" />
      <UsersPanel />
    </div>
  );
}
