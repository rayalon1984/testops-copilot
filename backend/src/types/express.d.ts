import { User as AppUser, TokenPayload } from './user';

declare global {
  namespace Express {
    // Augment the User interface used by Passport
    interface User extends AppUser { }

    interface Request {
      user?: User;
      token?: string;
      tokenPayload?: TokenPayload;
      startTime?: number;
    }
  }
}

// This export is needed to make the file a module
export { };