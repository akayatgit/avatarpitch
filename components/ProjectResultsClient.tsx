'use client';

import { useRouter } from 'next/navigation';
import ProjectResults from './ProjectResults';

interface ProjectResultsClientProps {
  result: {
    scenes: Array<{
      index: number;
      shotType: string;
      camera: string;
      imagePrompt: string;
      negativePrompt?: string;
      onScreenText?: string;
      notes?: string;
      durationSeconds?: number;
      agentContributions?: any[];
      finalAssembler?: any;
      imageUrls?: string[];
    }>;
    renderingSpec: {
      aspectRatio: string;
      style: string;
      imageModelHint?: string;
      colorGrade?: string;
      lightingMood?: string;
      musicMood?: string;
      transitions?: string;
    };
    videoUrl: string;
    templateName: string;
    projectId?: string;
  };
}

export default function ProjectResultsClient({ result }: ProjectResultsClientProps) {
  const router = useRouter();

  // For viewing saved projects, "Start New" should go back to dashboard
  const handleStartNew = () => {
    router.push('/app');
  };

  return <ProjectResults result={result} onStartNew={handleStartNew} />;
}

