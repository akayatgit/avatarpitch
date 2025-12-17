'use client';

import Link from 'next/link';

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Just now (less than 1 minute)
  if (diffInSeconds < 60) {
    return 'just now';
  }

  // Minutes ago
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min${diffInMinutes !== 1 ? 's' : ''} ago`;
  }

  // Hours ago
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hr${diffInHours !== 1 ? 's' : ''} ago`;
  }

  // Days ago
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'yesterday';
  }
  if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  }

  // Weeks ago
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks !== 1 ? 's' : ''} ago`;
  }

  // Months ago
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }

  // Years ago
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
}

interface Project {
  id: string;
  name: string;
  template_name: string | null;
  product_name: string;
  platform: string;
  created_at: string;
  scenes: Array<{
    index: number;
    imageUrls?: string[];
  }> | null;
}

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 text-base">No projects found. Create your first project to get started!</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Project Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                Template
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Scenes
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Images
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => {
              const scenes = project.scenes || [];
              const sceneCount = scenes.length;
              
              // Collect all image URLs from all scenes
              const allImages: string[] = scenes.flatMap((scene) => scene.imageUrls || []);
              
              return (
                <tr key={project.id} className="hover:bg-gray-50 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/app/projects/${project.id}`}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 active:text-primary-800 transition-colors duration-200"
                    >
                      {project.name}
                    </Link>
                    <div className="text-xs text-gray-500 sm:hidden mt-1">
                      {project.template_name && (
                        <span className="mr-2">Template: {project.template_name}</span>
                      )}
                      <span className="mr-2">Scenes: {sceneCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 hidden sm:table-cell">
                    {project.template_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4">
                    {allImages.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {allImages.slice(0, 4).map((imageUrl, idx) => (
                          <img
                            key={idx}
                            src={imageUrl}
                            alt={`Scene ${idx + 1}`}
                            className="w-12 h-12 object-cover rounded-lg border border-gray-200 shadow-sm"
                            loading="lazy"
                          />
                        ))}
                        {allImages.length > 4 && (
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200 text-xs text-gray-600 font-medium shadow-sm">
                            +{allImages.length - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {getRelativeTime(project.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

