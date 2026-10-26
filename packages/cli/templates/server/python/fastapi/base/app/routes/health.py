import time
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()

_STARTED_AT = time.time()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "uptime": time.time() - _STARTED_AT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
