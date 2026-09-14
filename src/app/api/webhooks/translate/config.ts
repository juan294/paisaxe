// BE-H6: Three jobs at the worst observed 15 seconds each keep the batch
// within the route's explicit 60-second maxDuration while leaving 15 seconds
// of margin. These live outside route.ts because Next.js route modules may
// only export handlers and supported route-segment configuration.
export const TRANSLATE_JOB_BATCH_SIZE = 3;
export const TRANSLATE_JOB_PER_JOB_MAX_SECONDS = 15;
