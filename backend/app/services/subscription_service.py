"""
Subscription service — plan seeding, enforcement helpers.
"""
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.chatbot import Chatbot


# ── Plan Definitions ──────────────────────────────────

DEFAULT_PLANS = [
    {
        "name": "FREE",
        "price_monthly": 0.0,
        "max_chatbots": 1,
        "allow_whatsapp": False,
        "allow_google_sync": True,
    },
    {
        "name": "BETA",
        "price_monthly": 15.0,
        "max_chatbots": 10,
        "allow_whatsapp": False,
        "allow_google_sync": True,
    },
    {
        "name": "ALFA",
        "price_monthly": 30.0,
        "max_chatbots": 25,
        "allow_whatsapp": True,
        "allow_google_sync": True,
    },
    {
        "name": "CUSTOM",
        "price_monthly": 0.0,
        "max_chatbots": None,  # unlimited
        "allow_whatsapp": True,
        "allow_google_sync": True,
    },
]


# ── Seeding ───────────────────────────────────────────

async def seed_default_plans(db: AsyncSession):
    """Insert default plans if they don't already exist."""
    for plan_data in DEFAULT_PLANS:
        result = await db.execute(
            select(Plan).where(Plan.name == plan_data["name"])
        )
        if not result.scalar_one_or_none():
            plan = Plan(**plan_data)
            db.add(plan)
    await db.commit()
    print("✅ Plans seeded")


# ── Free Plan Assignment ──────────────────────────────

async def assign_free_plan(db: AsyncSession, user_id: str):
    """Create a FREE subscription for a newly registered user."""
    # Check if user already has a subscription
    existing = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    if existing.scalar_one_or_none():
        return  # Already has a subscription

    # Get FREE plan
    result = await db.execute(
        select(Plan).where(Plan.name == "FREE")
    )
    free_plan = result.scalar_one_or_none()
    if not free_plan:
        print("⚠️ FREE plan not found — skipping assignment")
        return

    sub = Subscription(
        user_id=user_id,
        plan_id=free_plan.id,
        status="active",
    )
    db.add(sub)
    await db.flush()


# ── Subscription Lookup ──────────────────────────────

async def get_user_subscription(db: AsyncSession, user_id: str):
    """Get user's active subscription with plan details.
    Returns (subscription, plan) tuple or (None, None).
    """
    result = await db.execute(
        select(Subscription, Plan)
        .join(Plan, Subscription.plan_id == Plan.id)
        .where(
            Subscription.user_id == user_id,
            Subscription.status == "active",
        )
    )
    row = result.first()
    if row:
        return row[0], row[1]
    return None, None


# ── Enforcement Checks ───────────────────────────────

async def check_chatbot_limit(db: AsyncSession, user_id: str):
    """Raise 403 if user has reached their chatbot limit."""
    sub, plan = await get_user_subscription(db, user_id)

    if not sub or not plan:
        raise HTTPException(
            status_code=403,
            detail="No active subscription found. Please contact support.",
        )

    # None means unlimited
    if plan.max_chatbots is None:
        return

    # Count existing chatbots
    result = await db.execute(
        select(func.count(Chatbot.id)).where(Chatbot.user_id == user_id)
    )
    current_count = result.scalar() or 0

    if current_count >= plan.max_chatbots:
        raise HTTPException(
            status_code=403,
            detail=f"Plan limit reached. Your {plan.name} plan allows {plan.max_chatbots} chatbot(s). Please upgrade.",
        )


async def check_whatsapp_allowed(db: AsyncSession, user_id: str):
    """Raise 403 if user's plan doesn't allow WhatsApp."""
    sub, plan = await get_user_subscription(db, user_id)

    if not sub or not plan:
        raise HTTPException(
            status_code=403,
            detail="No active subscription found.",
        )

    if not plan.allow_whatsapp:
        raise HTTPException(
            status_code=403,
            detail="WhatsApp integration is available on the ALFA plan and above. Please upgrade.",
        )


async def get_usage_stats(db: AsyncSession, user_id: str) -> dict:
    """Get current usage stats for a user."""
    sub, plan = await get_user_subscription(db, user_id)

    # Count chatbots
    result = await db.execute(
        select(func.count(Chatbot.id)).where(Chatbot.user_id == user_id)
    )
    chatbot_count = result.scalar() or 0

    return {
        "plan_name": plan.name if plan else "FREE",
        "plan_price": plan.price_monthly if plan else 0,
        "chatbots_used": chatbot_count,
        "chatbots_max": plan.max_chatbots if plan else 1,
        "allow_whatsapp": plan.allow_whatsapp if plan else False,
        "allow_google_sync": plan.allow_google_sync if plan else True,
        "subscription_status": sub.status if sub else "none",
    }
