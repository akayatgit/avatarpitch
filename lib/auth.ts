import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { supabaseAdmin } from './supabaseAdmin';

export const authOptions: NextAuthOptions = {
  // Set the base URL for constructing callback URLs
  // This ensures the redirect URI matches what's configured in Google Cloud Console
  basePath: '/api/auth',
  // Use NEXTAUTH_URL if set, otherwise default to localhost:3001
  url: process.env.NEXTAUTH_URL || 'http://localhost:3001',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Check if user exists in our users table
          // Use .maybeSingle() instead of .single() to avoid errors when user doesn't exist
          const { data: existingUser, error: checkError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', user.email)
            .maybeSingle();

          // If there's an error checking (not just "not found"), log it but continue
          if (checkError && checkError.code !== 'PGRST116') {
            console.error('Error checking for existing user:', checkError);
          }

          // If user doesn't exist, create them
          if (!existingUser) {
            console.log('User does not exist, creating new user for email:', user.email);
            
            // Generate UUID for new user
            const { randomUUID } = await import('crypto');
            const userId = randomUUID();
            
            console.log('Generated user ID:', userId);
            
            // Create new user with 50 free credits
            const { data: newUser, error: insertError } = await supabaseAdmin
              .from('users')
              .insert({
                id: userId,
                email: user.email,
                credits: 50,
                role: 'user',
              })
              .select()
              .single();

            if (insertError) {
              console.error('Error creating user - Full error details:', JSON.stringify(insertError, null, 2));
              console.error('Error code:', insertError.code);
              console.error('Error message:', insertError.message);
              console.error('Error details:', insertError.details);
              console.error('Error hint:', insertError.hint);
              // Still allow sign-in but log the error for debugging
              return true;
            } else if (newUser) {
              console.log('✅ New user created successfully:', {
                id: newUser.id,
                email: newUser.email,
                credits: newUser.credits,
                role: newUser.role
              });
            } else {
              console.warn('⚠️ Insert returned no error but also no user data');
            }
          } else {
            console.log('✅ Existing user found:', existingUser.id);
          }

          // Always return true to allow sign-in
          return true;
        } catch (error) {
          console.error('Unexpected error in signIn callback:', error);
          // Even on unexpected errors, allow sign-in to proceed
          // This prevents blocking legitimate users due to transient DB issues
          return true;
        }
      }
      // Allow sign-in for non-Google providers or if email is missing
      return true;
    },
    async session({ session, token }) {
      const email = session.user?.email || (token.email as string);
      if (email) {
        // Fetch user data from our database
        const { data: userData, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id, email, credits, role')
          .eq('email', email)
          .maybeSingle();

        if (userData) {
          session.user.id = userData.id;
          session.user.email = userData.email || email;
          session.user.credits = userData.credits || 0;
          session.user.role = (userData.role as 'user' | 'admin' | 'superuser') || 'user';
        } else if (token.id) {
          // Fallback to token ID if database lookup fails
          console.warn('Session: User not found in DB, using token ID:', token.id);
          session.user.id = token.id as string;
          session.user.email = email;
          session.user.credits = 0;
          session.user.role = 'user';
        } else {
          console.error('Session: No user data and no token ID available');
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      // On first sign in, user object is available
      if (user?.email && account?.provider === 'google') {
        // Fetch user ID from database
        const { data: userData, error: fetchError } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', user.email)
          .maybeSingle();
        
        if (userData) {
          token.id = userData.id;
          token.email = user.email;
          console.log('JWT: Found user in database:', userData.id);
        } else {
          // User not found - try to create them as a fallback
          console.log('JWT: User not found in database, attempting to create...');
          const { randomUUID } = await import('crypto');
          const userId = randomUUID();
          
          const { data: newUser, error: insertError } = await supabaseAdmin
            .from('users')
            .insert({
              id: userId,
              email: user.email,
              credits: 50,
              role: 'user',
            })
            .select()
            .single();

          if (insertError) {
            console.error('JWT: Error creating user in fallback:', JSON.stringify(insertError, null, 2));
          } else if (newUser) {
            console.log('JWT: ✅ User created successfully in fallback:', newUser.id);
            token.id = newUser.id;
            token.email = user.email;
          }
        }
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

