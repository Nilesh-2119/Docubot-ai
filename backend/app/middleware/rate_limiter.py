"""
Rate limiting middleware.
In-memory rate limiter for MVP. Replace with Redis for production.
"""
import time
from collections import defaultdict
from fastapi import HTTPException, status, Request


class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _cleanup(self, key: str):
        """Remove expired request timestamps."""
        now = time.time()
        self._requests[key] = [
            ts for ts in self._requests[key]
            if now - ts < self.window_seconds
        ]

    def check(self, key: str) -> bool:
        """Check if the key has exceeded the rate limit."""
        self._cleanup(key)
        if len(self._requests[key]) >= self.max_requests:
            return False

        self._requests[key].append(time.time())
        return True

    def remaining(self, key: str) -> int:
        """Get remaining requests for a key."""
        self._cleanup(key)
        return max(0, self.max_requests - len(self._requests[key]))


# Global rate limiter instances
chat_limiter = RateLimiter(max_requests=30, window_seconds=60)
upload_limiter = RateLimiter(max_requests=10, window_seconds=60)
auth_limiter = RateLimiter(max_requests=5, window_seconds=60)


def check_rate_limit(limiter: RateLimiter, key: str, action: str = "requests"):
    """Check rate limit and raise HTTP exception if exceeded."""
    if not limiter.check(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many {action}. Please try again later.",
        )
