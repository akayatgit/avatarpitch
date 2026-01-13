import LoginPage from '@/components/LoginPage';
import Link from 'next/link';

export default function Login() {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      <div className="p-4 sm:p-6 lg:p-8">
        <Link href="/app" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
          <span>← Back to Home</span>
        </Link>
      </div>
      <LoginPage />
    </div>
  );
}

