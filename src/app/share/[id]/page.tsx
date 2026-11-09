import { Suspense } from "react";
import WorkOrderShareView from "./WorkOrderShareView";

export default function SharePage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400 text-sm">작업지시서 불러오는 중...</div>
      </div>
    }>
      <WorkOrderShareView id={params.id} />
    </Suspense>
  );
}
