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
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Hauloo Apps</h1>
        <p className="text-sm text-gray-400">Create ready-to-share content in one click — from viral effects to polished commercials, no editing needed.</p>
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
              className="card cursor-pointer group hover:shadow-md transition-all duration-200 active:scale-[0.98] touch-manipulation p-0 overflow-hidden flex flex-col aspect-[9/16]"
            >
              <div className="relative flex-1 w-full overflow-hidden bg-gray-900">
                {contentType.cover_image_url ? (
                  <img
                    src={contentType.cover_image_url}
                    alt={contentType.name}
                    className="w-full h-full object-cover aspect-[9/16]"
                  />
                ) : (
                  <div className="w-full h-full aspect-[9/16] bg-gray-900 border-2 border-dashed border-gray-700 flex flex-col items-center justify-center">
                    <div className="text-4xl mb-2">📷</div>
                    <div className="text-xs text-gray-400 font-medium text-center px-2">No image</div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 text-black text-sm px-4 py-2 bg-[#D1FE17] rounded-lg hover:bg-[#B8E014] transition-all duration-200 font-medium">
                    Create
                  </div>
                </div>
              </div>
              <div className="p-3 bg-black border-t border-gray-800">
                <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">{contentType.name}</h3>
                {contentType.description && (
                  <p className="text-xs text-gray-400 mb-2 line-clamp-2">{contentType.description}</p>
                )}
                {contentType.category && (
                  <span className="text-xs text-gray-500">{contentType.category}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

