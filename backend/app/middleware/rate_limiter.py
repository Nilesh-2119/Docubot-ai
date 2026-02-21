import logging
from redis.asyncio import Redis, from_url
from fastapi import HTTPException, status
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Initialize Redis client
redis_client = from_url(settings.REDIS_URL, decode_responses=True)

class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60, prefix: str = "rl"):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.prefix = prefix

    async def check(self, key: str) -> bool:
        """
        Check if the key has exceeded the rate limit using Redis.
        Uses a fixed-window counter for efficiency.
        """
        full_key = f"{self.prefix}:{key}"
        try:
            # Atomic increment
            count = await redis_client.incr(full_key)
            
            # If it's the first request in the window, set expiry
            if count == 1:
                await redis_client.expire(full_key, self.window_seconds)
            
            return count <= self.max_requests
        except Exception as e:
            # Fail-open: if Redis is down, allow the request but log the error
            logger.error(f"Redis RateLimiter error: {e}")
            return True

    async def remaining(self, key: str) -> int:
        """Get remaining requests for a key."""
        full_key = f"{self.prefix}:{key}"
        try:
            count_str = await redis_client.get(full_key)
            count = int(count_str) if count_str else 0
            return max(0, self.max_requests - count)
        except Exception:
            return self.max_requests


# Global rate limiter instances
chat_limiter = RateLimiter(max_requests=30, window_seconds=60, prefix="rl:chat")
upload_limiter = RateLimiter(max_requests=10, window_seconds=60, prefix="rl:upload")
auth_limiter = RateLimiter(max_requests=5, window_seconds=60, prefix="rl:auth")


async def check_rate_limit(limiter: RateLimiter, key: str, action: str = "requests"):
    """Check rate limit and raise HTTP exception if exceeded."""
    if not await limiter.check(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many {action}. Please try again later.",
        )
