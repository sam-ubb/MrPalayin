// Rate limiter simple por usuario+clave usando token bucket en memoria
export class RateLimiter {
  constructor({ tokensPerInterval, intervalMs, burst }) {
    this.capacity = burst ?? tokensPerInterval;
    this.tokensPerInterval = tokensPerInterval;
    this.intervalMs = intervalMs;
    this.buckets = new Map();
  }
  _refill(bucket) {
    const now = Date.now();
    const delta = now - bucket.updated;
    if (delta <= 0) return;
    const add = (delta / this.intervalMs) * this.tokensPerInterval;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + add);
    bucket.updated = now;
  }
  take(key, cost=1) {
    let bucket = this.buckets.get(key);
    if (!bucket) { bucket = { tokens: this.capacity, updated: Date.now() }; this.buckets.set(key, bucket); }
    this._refill(bucket);
    if (bucket.tokens >= cost) { bucket.tokens -= cost; return true; }
    return false;
  }
}
