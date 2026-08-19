import CarouselMakerWizard from '@/components/carousel-maker/CarouselMakerWizard';

export const dynamic = 'force-dynamic';

/**
 * Carousel Maker is fully self-contained: the draft lives in the browser
 * (localStorage), uploads and generated slides land in Supabase Storage,
 * and generation runs through Nano Banana Pro on Replicate.
 */
export default function CarouselMakerPage() {
  return <CarouselMakerWizard />;
}
