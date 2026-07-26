import WorkflowPicker from '@/components/workflows/WorkflowPicker';

export default function Dashboard() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8 min-h-[calc(100vh-4rem)]">
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Surreal Tech Footage</h1>
        <p className="text-sm text-gray-400">
          Pick a template. First choose a surrealism mix and what you&apos;ll explain — we invent
          epic computer-world ideas, then generate stills, paths, and Seedance 2.0 video.
        </p>
      </div>

      <WorkflowPicker />
    </div>
  );
}
