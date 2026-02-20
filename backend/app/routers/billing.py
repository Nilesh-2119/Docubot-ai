"""
Billing routes — plans list, current subscription/usage, Stripe checkout + webhook.
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.middleware.auth_middleware import get_current_user
from app.services.subscription_service import get_usage_stats, get_user_subscription

settings = get_settings()
stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/billing", tags=["Billing"])

# Map plan names to Stripe price IDs
PLAN_STRIPE_PRICES = {
    "BETA": settings.STRIPE_PRICE_BETA,
    "ALFA": settings.STRIPE_PRICE_ALFA,
}


# ── Public: List Plans ────────────────────────────────

@router.get("/plans")
async def list_plans(db: AsyncSession = Depends(get_db)):
    """List all available plans."""
    result = await db.execute(select(Plan).order_by(Plan.price_monthly))
    plans = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "price_monthly": p.price_monthly,
            "max_chatbots": p.max_chatbots,
            "allow_whatsapp": p.allow_whatsapp,
            "allow_google_sync": p.allow_google_sync,
        }
        for p in plans
    ]


# ── Current Subscription + Usage ──────────────────────

@router.get("/subscription")
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's current subscription and usage stats."""
    usage = await get_usage_stats(db, current_user.id)
    return usage


# ── Stripe Checkout ───────────────────────────────────

@router.post("/create-checkout-session")
async def create_checkout_session(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for plan upgrade."""
    plan_name = data.get("plan_name", "").upper()

    if plan_name not in PLAN_STRIPE_PRICES:
        raise HTTPException(status_code=400, detail="Invalid plan")

    price_id = PLAN_STRIPE_PRICES[plan_name]
    if not price_id:
        raise HTTPException(
            status_code=400,
            detail="Stripe price not configured for this plan.",
        )

    # Get or create Stripe customer
    sub, _ = await get_user_subscription(db, current_user.id)
    customer_id = sub.stripe_customer_id if sub else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=current_user.full_name,
            metadata={"user_id": current_user.id},
        )
        customer_id = customer.id
        # Save customer ID
        if sub:
            sub.stripe_customer_id = customer_id
            await db.flush()

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{settings.APP_URL}/dashboard/billing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.APP_URL}/dashboard/billing?cancelled=true",
            metadata={
                "user_id": current_user.id,
                "plan_name": plan_name,
            },
        )
        return {"checkout_url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")


# ── Verify Checkout (for localhost / no-webhook fallback) ─

@router.post("/verify-checkout")
async def verify_checkout(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify a Stripe checkout session and upgrade the user's plan.
    Called by the frontend after redirect from Stripe Checkout.
    """
    session_id = data.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid session: {str(e)}")

    # Verify the session belongs to this user
    session_user_id = session.get("metadata", {}).get("user_id")
    if session_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Session does not belong to you")

    if session.payment_status != "paid":
        raise HTTPException(status_code=400, detail="Payment not completed")

    plan_name = session.get("metadata", {}).get("plan_name")
    if not plan_name:
        raise HTTPException(status_code=400, detail="Plan not found in session")

    # Find the plan
    result = await db.execute(select(Plan).where(Plan.name == plan_name))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=400, detail=f"Plan {plan_name} not found")

    # Update subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    sub = result.scalar_one_or_none()

    if sub:
        sub.plan_id = plan.id
        sub.status = "active"
        sub.stripe_customer_id = session.get("customer")
        sub.stripe_subscription_id = session.get("subscription")
    else:
        sub = Subscription(
            user_id=current_user.id,
            plan_id=plan.id,
            status="active",
            stripe_customer_id=session.get("customer"),
            stripe_subscription_id=session.get("subscription"),
        )
        db.add(sub)

    await db.commit()
    print(f"✅ User {current_user.email} upgraded to {plan_name} via verify-checkout")
    return {"status": "upgraded", "plan": plan_name}


# ── Stripe Webhook ────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook")

    event_type = event["type"]
    data_obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(db, data_obj)
    elif event_type == "invoice.payment_succeeded":
        await _handle_payment_succeeded(db, data_obj)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(db, data_obj)

    return {"status": "ok"}


async def _handle_checkout_completed(db: AsyncSession, session: dict):
    """Upgrade user's plan after successful checkout."""
    user_id = session.get("metadata", {}).get("user_id")
    plan_name = session.get("metadata", {}).get("plan_name")
    stripe_sub_id = session.get("subscription")
    stripe_customer_id = session.get("customer")

    if not user_id or not plan_name:
        return

    # Find the plan
    result = await db.execute(select(Plan).where(Plan.name == plan_name))
    plan = result.scalar_one_or_none()
    if not plan:
        return

    # Update subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()

    if sub:
        sub.plan_id = plan.id
        sub.status = "active"
        sub.stripe_customer_id = stripe_customer_id
        sub.stripe_subscription_id = stripe_sub_id
    else:
        sub = Subscription(
            user_id=user_id,
            plan_id=plan.id,
            status="active",
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_sub_id,
        )
        db.add(sub)

    await db.commit()
    print(f"✅ User {user_id} upgraded to {plan_name}")


async def _handle_payment_succeeded(db: AsyncSession, invoice: dict):
    """Renew subscription period on successful payment."""
    stripe_sub_id = invoice.get("subscription")
    if not stripe_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_sub_id
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.status = "active"
        from datetime import datetime
        period_start = invoice.get("period_start")
        period_end = invoice.get("period_end")
        if period_start:
            sub.current_period_start = datetime.utcfromtimestamp(period_start)
        if period_end:
            sub.current_period_end = datetime.utcfromtimestamp(period_end)
        await db.commit()


async def _handle_subscription_deleted(db: AsyncSession, sub_data: dict):
    """Downgrade user to FREE when subscription is cancelled."""
    stripe_sub_id = sub_data.get("id")

    result = await db.execute(
        select(Subscription).where(
            Subscription.stripe_subscription_id == stripe_sub_id
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return

    # Downgrade to FREE plan
    result = await db.execute(select(Plan).where(Plan.name == "FREE"))
    free_plan = result.scalar_one_or_none()

    if free_plan:
        sub.plan_id = free_plan.id
        sub.status = "active"
        sub.stripe_subscription_id = None
        await db.commit()
        print(f"⬇️ User {sub.user_id} downgraded to FREE")
