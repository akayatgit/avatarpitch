import NextAuth from 'next-auth';
import { authOptions } from './auth';

// Create the NextAuth instance
const { handlers, auth } = NextAuth(authOptions);

export { handlers, auth };

