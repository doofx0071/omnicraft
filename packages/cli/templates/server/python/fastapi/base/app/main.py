from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import health, users

description = """
Full-stack starter scaffolded by OmniCraft.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="{{projectName}}", description=lifespan.__doc__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(users.router, prefix="/api/users", tags=["users"])
