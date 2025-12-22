'use client';

interface NetworkErrorProps {
  message?: string;
}

export default function NetworkError({ message }: NetworkErrorProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-gray-800 rounded-xl p-6 sm:p-8 max-w-md w-full shadow-xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
          No Internet Connection
        </h2>
        <p className="text-sm sm:text-base text-gray-400 text-center mb-6">
          {message || 'Please check your internet connection and try again.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full btn-primary min-h-[44px]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

