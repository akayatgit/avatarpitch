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
  status?: string;
  isGenerating?: boolean;
}

interface ProjectListProps {
  projects: Project[];
}

export default function ProjectList({ projects }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 px-4">
        <div className="max-w-md w-full text-center space-y-5">
          {/* Welcome Text */}
          <div className="space-y-2 opacity-90">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Yay! Welcome to Hauloo.
            </h2>
          </div>

          {/* Illustration */}
          <div className="flex justify-center my-4 sm:my-6">
            <div className="relative w-full max-w-[200px] sm:max-w-[240px] opacity-90">
              <img
                src="/welcome.svg"
                alt=""
                className="w-full h-auto object-contain"
                onError={(e) => {
                  // Hide image if it fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Call to Action Text and Button */}
          <div className="space-y-4 opacity-90">
            <h3 className="text-lg sm:text-xl font-semibold text-white">
              Lets start your marketing campaign..
            </h3>
            
            {/* CTA Button */}
            <div>
              <Link
                href="/app/create"
                className="btn-primary inline-flex items-center justify-center min-h-[44px] animate-pulse-button"
              >
                <span>Create Content</span>
              </Link>
            </div>
            
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              It takes just 2 minutes to turn your product into an ad.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900 border-b border-gray-800">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Project Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                Content Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Scenes
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Images
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-black divide-y divide-gray-800">
            {projects.map((project) => {
              const scenes = project.scenes || [];
              const sceneCount = scenes.length;
              const isGenerating = project.isGenerating || (project.status === 'pending' && sceneCount === 0);
              
              // Collect all image URLs from all scenes
              const allImages: string[] = scenes.flatMap((scene) => scene.imageUrls || []);
              
              return (
                <tr key={project.id} className="hover:bg-gray-900 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link
                      href={`/app/projects/${project.id}`}
                      className="text-sm font-medium text-[#D1FE17] hover:text-[#B8E014] active:text-[#9FC211] transition-colors duration-200"
                    >
                      {project.name}
                    </Link>
                    <div className="text-xs text-gray-500 sm:hidden mt-1">
                      {project.template_name && (
                        <span className="mr-2">Content Type: {project.template_name}</span>
                      )}
                      {isGenerating ? (
                        <span className="mr-2 flex items-center gap-1">
                          <span className="w-3 h-3 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin"></span>
                          Generating...
                        </span>
                      ) : (
                        <span className="mr-2">Scenes: {sceneCount}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden sm:table-cell">
                    {project.template_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-medium">
                    {isGenerating ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#D1FE17] border-t-transparent rounded-full animate-spin"></span>
                        <span className="text-gray-400">Generating...</span>
                      </span>
                    ) : (
                      <span>{sceneCount} scene{sceneCount !== 1 ? 's' : ''}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {allImages.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {allImages.slice(0, 4).map((imageUrl, idx) => (
                          <img
                            key={idx}
                            src={imageUrl}
                            alt={`Scene ${idx + 1}`}
                            className="w-12 h-12 object-cover rounded-lg border border-gray-800 shadow-sm"
                            loading="lazy"
                          />
                        ))}
                        {allImages.length > 4 && (
                          <div className="w-12 h-12 flex items-center justify-center bg-gray-900 rounded-lg border border-gray-800 text-xs text-gray-400 font-medium shadow-sm">
                            +{allImages.length - 4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
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

