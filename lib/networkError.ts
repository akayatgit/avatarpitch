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
  const errorCode = error.code?.toLowerCase() || '';
  
  // Check for specific Supabase error codes that indicate network issues
  // PGRST116 = connection timeout, PGRST301 = service unavailable
  const networkErrorCodes = ['pgrst116', 'pgrst301', 'econnrefused', 'enotfound', 'etimedout'];
  
  // Check if it's a known network error code
  if (networkErrorCodes.some(code => errorCode.includes(code))) {
    return true;
  }
  
  // Check for network-related error messages, but exclude common database errors
  // that might contain "connection" but aren't network issues
  const databaseErrorIndicators = ['relation', 'column', 'syntax', 'permission', 'authentication', 'authorization'];
  const isDatabaseError = databaseErrorIndicators.some(indicator => errorMessage.includes(indicator));
  
  if (isDatabaseError) {
    return false; // Don't treat database errors as network errors
  }
  
  return isNetworkError({ message: errorMessage });
}

