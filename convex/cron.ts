import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// Cleanup expired API key sessions every hour
crons.hourly(
  "cleanup-expired-api-keys",
  {
    hourUTC: 0, // Run at minute 0 of each hour
    minuteUTC: 0,
  },
  api.apiKeys.cleanupExpiredSessions
);

export default crons;

