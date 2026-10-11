// Shared result shape so both limiters can be logged in the same format
export interface TakeResult {
  allowed: boolean;
  seen: string | null; // tokens value as read from Redis before taking (null = bucket didn't exist)
  left: number; // tokens remaining after this request
}