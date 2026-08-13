'use client';

import { useRouter } from 'next/navigation';
import DroneTracingShotStudio from '@/components/workflows/drone-tracing-shot/DroneTracingShotStudio';

export default function DroneShotPage() {
  const router = useRouter();

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">
      <DroneTracingShotStudio onBack={() => router.push('/app')} />
    </div>
  );
}
