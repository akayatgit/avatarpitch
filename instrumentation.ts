export const runtime = 'nodejs';

export function register() {
  // Corporate TLS interception (common on Siemens networks) breaks Node's
  // default CA trust for OpenAI / Replicate. Allow outbound HTTPS in local/dev.
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding, callback?: () => void) => {
    const text =
      typeof chunk === 'string'
        ? chunk
        : Buffer.from(chunk).toString((encoding as BufferEncoding) || 'utf8');

    if (/^\s*(GET|POST|PUT|PATCH|DELETE) \/.*\s\d{3}\s+in\s+\d+ms\s*$/.test(text)) {
      if (callback) {
        callback();
      }
      return true;
    }

    return originalWrite(chunk as never, encoding as never, callback as never);
  }) as typeof process.stdout.write;
}
