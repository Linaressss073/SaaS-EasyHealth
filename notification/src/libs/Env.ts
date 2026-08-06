import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  server: {
    MAILTRAP_HOST: z.string().min(1),
    MAILTRAP_PORT: z.coerce.number().int().positive(),
    MAILTRAP_USER: z.string().min(1),
    MAILTRAP_PASS: z.string().min(1),
    MAIL_FROM_ADDRESS: z.email(),
    MAIL_FROM_NAME: z.string().min(1),
    CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  runtimeEnv: {
    MAILTRAP_HOST: process.env.MAILTRAP_HOST,
    MAILTRAP_PORT: process.env.MAILTRAP_PORT,
    MAILTRAP_USER: process.env.MAILTRAP_USER,
    MAILTRAP_PASS: process.env.MAILTRAP_PASS,
    MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
    MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
    CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
});
