/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js', 'ffmpeg-static'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // The ffmpeg binary is a plain file (not a require()), so Vercel's function
    // tracer misses it and ffmpeg routes fail with ENOENT in production.
    // Force-include it in every function that shells out to ffmpeg.
    outputFileTracingIncludes: {
      '/api/job-reel/render': ['./node_modules/ffmpeg-static/ffmpeg'],
      '/api/assembly/stitch': ['./node_modules/ffmpeg-static/ffmpeg'],
    },
  },
};

module.exports = nextConfig;
