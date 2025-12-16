/**
 * Checks if an error is a network-related error
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';

  // Common network error indicators
  const networkIndicators = [
    'network',
    'fetch',
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'eai_again',
    'failed to fetch',
    'networkerror',
    'network request failed',
    'internet',
    'offline',
    'no internet',
  ];

  return (
    networkIndicators.some((indicator) => 
      errorMessage.includes(indicator) || 
      errorCode.includes(indicator) || 
      errorName.includes(indicator)
    ) ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('ETIMEDOUT') ||
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ENOTFOUND' ||
    errorCode === 'ETIMEDOUT'
  );
}

/**
 * Checks if a Supabase error is network-related
 */
export function isSupabaseNetworkError(error: any): boolean {
  if (!error) return false;

  // Supabase errors can have different structures
  const errorMessage = (error.message || error.error || String(error)).toLowerCase();

  return isNetworkError({ message: errorMessage });
}

