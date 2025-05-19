declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
      role: 'admin' | 'user';
      firstName: string;
      lastName: string;
    };
  }
}