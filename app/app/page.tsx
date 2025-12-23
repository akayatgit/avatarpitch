import { supabaseAdmin } from '@/lib/supabaseAdmin';
import Link from 'next/link';
import NetworkError from '@/components/NetworkError';
import { isSupabaseNetworkError } from '@/lib/networkError';

// Disable caching to ensure fresh data from database
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Dashboard() {
  console.log('[Dashboard] Function started');
  
  // Fetch content types
  console.log('[Dashboard] Fetching content types...');
  let contentTypes: any[] = [];
  try {
    const { data: contentTypesData, error: contentTypesError } = await supabaseAdmin
      .from('content_types')
      .select('id, name, description, category, cover_image_url')
      .order('name', { ascending: true });
    
    if (contentTypesError && isSupabaseNetworkError(contentTypesError)) {
      console.error('[Dashboard] Network error fetching content types');
      return <NetworkError message="Unable to load content types. Please check your internet connection." />;
    }
    
    if (!contentTypesError && contentTypesData) {
      contentTypes = contentTypesData;
    }
  } catch (error: any) {
    console.error('[Dashboard] Unexpected error fetching content types:', error);
    if (isSupabaseNetworkError(error)) {
      return <NetworkError message="Unable to load content types. Please check your internet connection." />;
    }
  }

  console.log('[Dashboard] Starting render...');

  return (
    <div className="p-4 sm:p-6 lg:p-8 pb-8 lg:pb-8 min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Apps</h1>
        <p className="text-sm text-gray-400">Create ad-ready creatives instantly</p>
          </div>

      {/* Content Types Grid */}
      {contentTypes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-300 mb-4">
            No content types found. Please create a content type first.
          </p>
          <Link
            href="/app/templates"
            className="btn-primary inline-flex items-center justify-center gap-2 min-h-[44px]"
          >
            <span>+</span>
            <span>Create Content Type</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {contentTypes.map((contentType: any) => (
            <Link
              key={contentType.id}
              href={`/app/create?contentTypeId=${contentType.id}`}
              className="card cursor-pointer group hover:shadow-md transition-all duration-200 active:scale-[0.98] touch-manipulation p-0 overflow-hidden flex flex-col rounded-lg"
            >
              <div className="relative w-full overflow-hidden bg-gray-900 aspect-square rounded-t-lg">
                {contentType.cover_image_url ? (
                  <img
                    src={contentType.cover_image_url}
                    alt={contentType.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-900 border-2 border-dashed border-gray-700 flex flex-col items-center justify-center">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-xs text-gray-400 font-medium text-center px-2">No image</div>
                  </div>
                )}
              </div>
              <div className="p-4 bg-black border-t border-gray-800 flex-shrink-0 rounded-b-lg">
                <h3 className="text-base font-semibold text-white mb-1 line-clamp-1">{contentType.name}</h3>
                {contentType.description && (
                  <p className="text-xs text-gray-400 mb-3 line-clamp-2">{contentType.description}</p>
                )}
                <div className="w-full text-black text-xs px-4 py-2 bg-[#D1FE17] rounded-lg hover:bg-[#B8E014] transition-all duration-200 font-bold flex items-center justify-center gap-2">
                  <span>Create</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

