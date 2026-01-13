import 'next-auth';

declare module 'next-auth' {
  interface User {
    id?: string;
    credits?: number;
    role?: 'user' | 'admin' | 'superuser';
  }

  interface Session {
    user: {
      id: string;
      email: string;
      credits: number;
      role: 'user' | 'admin' | 'superuser';
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    email?: string;
  }
}

