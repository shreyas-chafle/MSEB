from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import auth, customers, payments, routes, officers, assignments, dashboard, reports

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Electricity Bill Collection System Backend...")
    await connect_to_mongo()
    yield
    logger.info("Shutting down backend...")
    await close_mongo_connection()

app = FastAPI(
    title="Electricity Bill Collection & Navigation System API",
    description="Backend services for electricity department field officer collections, GIS map customer tracking, and route calculation.",
    version="1.0.0",
    lifespan=lifespan
)

# Custom Security & Anti-Caching Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    try:
        response: Response = await call_next(request)
    except Exception as exc:
        logger.error(f"Error in request pipeline {request.method} {request.url.path}: {exc}", exc_info=True)
        response = JSONResponse(
            status_code=500,
            content={"detail": f"Database or Server Error: {str(exc)}"}
        )

    if request.method != "OPTIONS":
        # Only disable caching on API endpoints (not pages/static assets)
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# Explicit origins allowed to access the API with credentials
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "https://mseb-nu.vercel.app",
]
for origin in settings.cors_origins:
    if origin != "*" and origin not in allowed_origins:
        allowed_origins.append(origin)

# Enable CORS for Next.js frontend (Supports Vercel, Render, Localhost, and custom domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|https?://localhost(:\d+)?|https?://127\.0\.0\.1(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error at {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Database or Server Error: {str(exc)}. Please verify MongoDB Atlas connection and server logs."
        }
    )


# Register API Routers
app.include_router(auth.router)
app.include_router(customers.router)
app.include_router(payments.router)
app.include_router(routes.router)
app.include_router(officers.router)
app.include_router(assignments.router)
app.include_router(dashboard.router)
app.include_router(reports.router)

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "service": "Electricity Bill Collection & Navigation System API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
