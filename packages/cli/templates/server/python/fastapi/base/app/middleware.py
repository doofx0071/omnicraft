"""Baseline security middleware: response headers and per-IP rate limiting.

Both are deliberately dependency-free and in-process: the generated API is a
single-worker dev server. A multi-worker or multi-instance deployment needs a
shared store (Redis, etc.) for its rate limits instead of this middleware.
"""

import math
import time

from fastapi.responses import JSONResponse
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings


class SecurityHeadersMiddleware:
    """Adds minimal security headers to every response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("x-content-type-options", "nosniff")
                headers.setdefault("x-frame-options", "deny")
                headers.setdefault("referrer-policy", "no-referrer")
            await send(message)

        await self.app(scope, receive, send_with_headers)


class RateLimitMiddleware:
    """Fixed-window rate limit for /api routes, keyed by client IP.

    Generous by default (RATE_LIMIT_MAX requests per RATE_LIMIT_WINDOW_MINUTES)
    — a dev/CRUD baseline, not a hard guard.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.max_requests = settings.rate_limit_max
        self.window_seconds = settings.rate_limit_window_minutes * 60
        self._hits: dict[str, tuple[int, float]] = {}

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        if scope["type"] != "http" or not (path == "/api" or path.startswith("/api/")):
            await self.app(scope, receive, send)
            return

        client = scope.get("client")
        key = client[0] if client else "unknown"
        now = time.monotonic()
        count, reset_at = self._hits.get(key, (0, now + self.window_seconds))
        if reset_at <= now:
            count, reset_at = 0, now + self.window_seconds

        if count >= self.max_requests:
            retry_after = max(1, math.ceil(reset_at - now))
            response = JSONResponse(
                {"error": "Too many requests"},
                status_code=429,
                headers={"Retry-After": str(retry_after)},
            )
            await response(scope, receive, send)
            return

        self._hits[key] = (count + 1, reset_at)

        # Drop expired buckets so abandoned client IPs do not accumulate forever.
        if len(self._hits) > 10_000:
            self._hits = {k: v for k, v in self._hits.items() if v[1] > now}

        await self.app(scope, receive, send)
