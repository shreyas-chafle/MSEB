import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("uvicorn.error")

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

async def connect_to_mongo():
    logger.info(f"Connecting to MongoDB at {settings.MONGODB_URI}...")
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    logger.info(f"Connected to database: {settings.DATABASE_NAME}")
    
    # Initialize indexes
    await init_db_indexes()

async def close_mongo_connection():
    if db_instance.client:
        logger.info("Closing MongoDB connection...")
        db_instance.client.close()
        logger.info("MongoDB connection closed.")

def get_database() -> AsyncIOMotorDatabase:
    return db_instance.db

async def init_db_indexes():
    """Ensure required indexes exist across collections."""
    db = db_instance.db
    if db is None:
        return

    try:
        # Users indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")

        # Customers indexes
        await db.customers.create_index("customer_id", unique=True)
        await db.customers.create_index("assigned_officer_id")
        await db.customers.create_index("uploaded_by_officer_id")
        await db.customers.create_index([("location", "2dsphere")])
        await db.customers.create_index("status")
        await db.customers.create_index("area")

        # Meters indexes
        await db.meters.create_index("meter_number", unique=True)
        await db.meters.create_index("customer_id")
        await db.meters.create_index("assigned_officer_id")
        await db.meters.create_index("uploaded_by_officer_id")




        # Payments indexes
        await db.payments.create_index("payment_id", unique=True)
        await db.payments.create_index("bill_id")
        await db.payments.create_index("customer_id")
        await db.payments.create_index("officer_id")
        await db.payments.create_index("created_at")

        # Officers indexes
        await db.officers.create_index("officer_id", unique=True)
        await db.officers.create_index("user_id", unique=True)
        await db.officers.create_index([("current_location", "2dsphere")])

        # Audit logs indexes
        await db.audit_logs.create_index("timestamp")
        await db.audit_logs.create_index("user_id")

        logger.info("Database indexes successfully initialized.")
    except Exception as e:
        logger.warning(f"Index initialization warning (may occur if DB offline or standing): {e}")
