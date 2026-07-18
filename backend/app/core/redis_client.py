import redis.asyncio as aioredis
from typing import Optional, Any
import json
from loguru import logger

from app.core.config import settings

_redis_client: Optional[aioredis.Redis] = None
_redis_unavailable: bool = False  # cached failure — skip retry until restart


async def get_redis() -> Optional[aioredis.Redis]:
    global _redis_client, _redis_unavailable
    if _redis_unavailable:
        return None
    if _redis_client is None:
        try:
            client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
                socket_connect_timeout=2,  # fail fast instead of waiting ~30s
                socket_timeout=2,
            )
            await client.ping()
            _redis_client = client
            logger.info("Redis connected")
        except Exception as e:
            logger.warning(f"Redis unavailable — running without cache: {e}")
            _redis_unavailable = True  # don't retry on every request
            _redis_client = None
    return _redis_client


async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


class CacheManager:
    def __init__(self, prefix: str = "salonsaas"):
        self.prefix = prefix
        self.default_ttl = settings.REDIS_CACHE_TTL

    def _key(self, key: str) -> str:
        return f"{self.prefix}:{key}"

    async def get(self, key: str) -> Optional[Any]:
        try:
            redis = await get_redis()
            if not redis:
                return None
            value = await redis.get(self._key(key))
            return json.loads(value) if value else None
        except Exception as e:
            logger.warning(f"Cache GET error: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        try:
            redis = await get_redis()
            if not redis:
                return False
            await redis.setex(self._key(key), ttl or self.default_ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.warning(f"Cache SET error: {e}")
            return False

    async def delete(self, key: str) -> bool:
        try:
            redis = await get_redis()
            if not redis:
                return False
            await redis.delete(self._key(key))
            return True
        except Exception as e:
            logger.warning(f"Cache DELETE error: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        try:
            redis = await get_redis()
            if not redis:
                return 0
            keys = await redis.keys(self._key(pattern))
            return await redis.delete(*keys) if keys else 0
        except Exception as e:
            logger.warning(f"Cache DELETE PATTERN error: {e}")
            return 0

    async def exists(self, key: str) -> bool:
        try:
            redis = await get_redis()
            if not redis:
                return False
            return bool(await redis.exists(self._key(key)))
        except Exception:
            return False

    async def increment(self, key: str, amount: int = 1, ttl: Optional[int] = None) -> int:
        try:
            redis = await get_redis()
            if not redis:
                return 0
            value = await redis.incrby(self._key(key), amount)
            if ttl:
                await redis.expire(self._key(key), ttl)
            return value
        except Exception as e:
            logger.warning(f"Cache INCR error: {e}")
            return 0


cache = CacheManager()


async def store_otp(identifier: str, otp: str, ttl: int = 600) -> bool:
    return await cache.set(f"otp:{identifier}", otp, ttl=ttl)


async def verify_otp(identifier: str, otp: str) -> bool:
    stored = await cache.get(f"otp:{identifier}")
    if stored and stored == otp:
        await cache.delete(f"otp:{identifier}")
        return True
    return False


async def blacklist_token(token: str, ttl: int = 900) -> bool:
    return await cache.set(f"blacklist:{token}", "1", ttl=ttl)


async def is_token_blacklisted(token: str) -> bool:
    return await cache.exists(f"blacklist:{token}")


async def check_rate_limit(key: str, limit: int, window: int) -> bool:
    count = await cache.increment(f"rate:{key}", ttl=window)
    return count <= limit
