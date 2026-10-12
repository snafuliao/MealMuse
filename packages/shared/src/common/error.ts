import { z } from 'zod';

/** 所有非 2xx 响应的统一形状。code 供程序判断，message 给人看。 */
export const ErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
