from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.routes import health, users

description = """
Full-stack starter scaffolded by OmniCraft.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="{{projectName}}", description=description, lifespan=lifespan)

# Baseline per-IP API rate limit and security headers, then CORS outermost so
# its headers still land on 429 responses. See app/middleware.py for the
# deliberate in-process, dependency-free design notes.
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(users.router, prefix="/api/users", tags=["users"])


@app.middleware("http")
async def api_not_found(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if response.status_code == 404 and (path == "/api" or path.startswith("/api/")):
        if request.scope.get("route") is None:
            return JSONResponse(status_code=404, content={"error": "Not found"})
    return response
