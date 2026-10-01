import MyTasksBoard from "../../components/dashboard/MyTasksBoard";

export default function MyTasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-surface-50">My Tasks</h2>
        <p className="text-surface-400 text-sm mt-1">Manage and track your assigned work.</p>
      </div>
      <MyTasksBoard />
    </div>
  );
}
