import CarouselMakerWizard from '@/components/carousel-maker/CarouselMakerWizard';

export const dynamic = 'force-dynamic';

/**
 * Carousel Maker is fully self-contained: photos stay in the browser as
 * data URLs, generation runs through Nano Banana Pro on Replicate, and
 * the user downloads the slide immediately. No storage backend.
 */
export default function CarouselMakerPage() {
  return <CarouselMakerWizard />;
}
