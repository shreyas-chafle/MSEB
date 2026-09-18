import logging
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger("uvicorn.error")

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

async def connect_to_mongo():
    masked_uri = settings.MONGODB_URI
    if "@" in masked_uri:
        prefix, rest = masked_uri.split("@", 1)
        if "://" in prefix:
            proto = prefix.split("://")[0]
            masked_uri = f"{proto}://*****:*****@{rest}"

    logger.info(f"Connecting to MongoDB at {masked_uri}...")
    
    client_kwargs = {
        "serverSelectionTimeoutMS": 10000,
    }
    
    # Use certifi CA certificates for robust TLS on Atlas / cloud deployments
    if "mongodb+srv" in settings.MONGODB_URI or "tls=true" in settings.MONGODB_URI.lower() or "ssl=true" in settings.MONGODB_URI.lower():
        try:
            client_kwargs["tlsCAFile"] = certifi.where()
        except Exception as e:
            logger.warning(f"Could not load certifi CA bundle: {e}")
        client_kwargs["tls"] = True
        client_kwargs["tlsAllowInvalidCertificates"] = True

    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URI, **client_kwargs)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]

    # Explicitly test connection on startup so connection issues are clearly logged
    try:
        await db_instance.client.admin.command('ping')
        logger.info(f"Connected to database successfully: {settings.DATABASE_NAME}")
    except Exception as e:
        logger.error(
            f"Failed to connect to MongoDB: {e}. "
            f"If deployed on Render/Cloud, make sure 0.0.0.0/0 is added to MongoDB Atlas Network Access IP Access List!"
        )
    
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
