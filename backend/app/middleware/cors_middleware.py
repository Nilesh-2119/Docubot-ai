from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import get_settings

settings = get_settings()

class SecureCORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("Origin")
        path = request.url.path

        # If no origin, just continue
        if not origin:
            return await call_next(request)

        # Restricted dashboard origins
        allowed_dashboard_origins = [
            settings.APP_URL,
            "http://localhost:3000",
            "http://localhost:3001",
        ]
        
        # Public paths that allow any origin
        public_paths = [
            "/api/widget",
            "/api/chat/public",
            "/api/chat/stream/public",
        ]

        is_public_route = any(path.startswith(p) for p in public_paths)
        is_dashboard_origin = origin in allowed_dashboard_origins

        # Handle Preflight (OPTIONS)
        if request.method == "OPTIONS":
            if is_public_route or is_dashboard_origin:
                response = Response()
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
                response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Max-Age"] = "86400"
                return response

        # Process the request
        response = await call_next(request)

        # Set headers for allowed routes
        if is_public_route or is_dashboard_origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"

        return response
