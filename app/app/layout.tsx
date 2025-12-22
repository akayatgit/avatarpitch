import TopNav from '@/components/TopNav';
import PromotionalBanner from '@/components/PromotionalBanner';
import { BannerProvider } from '@/contexts/BannerContext';
import BannerAwareMain from '@/components/BannerAwareMain';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BannerProvider>
      <div className="flex flex-col min-h-screen bg-black">
        <PromotionalBanner />
        <TopNav />
        <BannerAwareMain>{children}</BannerAwareMain>
      </div>
    </BannerProvider>
  );
}

