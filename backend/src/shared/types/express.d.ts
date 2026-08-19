declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        walletAddress: string;
        role: 'buyer' | 'organizer' | 'admin';
      };
    }
  }
}

export {};
