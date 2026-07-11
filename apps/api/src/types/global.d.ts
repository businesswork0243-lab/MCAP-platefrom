// apps/api/src/types/global.d.ts

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string;
        email: string;
        role: string;
        name: string;
      };
    }
  }
}

export {};
