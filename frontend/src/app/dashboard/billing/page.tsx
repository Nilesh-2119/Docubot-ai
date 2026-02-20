'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
    CreditCard, Zap, Bot, Shield,
    Check, X, ArrowUpRight, Loader2, Crown, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PlanData {
    id: string;
    name: string;
    price_monthly: number;
    max_chatbots: number | null;
    allow_whatsapp: boolean;
    allow_google_sync: boolean;
}

interface SubscriptionData {
    plan_name: string;
    plan_price: number;
    chatbots_used: number;
    chatbots_max: number | null;
    allow_whatsapp: boolean;
    allow_google_sync: boolean;
    subscription_status: string;
}



const PLAN_COLORS: Record<string, { gradient: string; badge: string; border: string; bg: string }> = {
    FREE: {
        gradient: 'from-dark-600 to-dark-700',
        badge: 'bg-dark-700 text-dark-300',
        border: 'border-dark-700',
        bg: 'bg-dark-800/50',
    },
    BETA: {
        gradient: 'from-blue-600 to-blue-700',
        badge: 'bg-blue-500/10 text-blue-400',
        border: 'border-blue-500/30',
        bg: 'bg-blue-500/5',
    },
    ALFA: {
        gradient: 'from-brand-500 to-brand-700',
        badge: 'bg-brand-500/10 text-brand-400',
        border: 'border-brand-500/30',
        bg: 'bg-brand-500/5',
    },
    CUSTOM: {
        gradient: 'from-amber-500 to-amber-700',
        badge: 'bg-amber-500/10 text-amber-400',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/5',
    },
};

const PLAN_ICONS: Record<string, any> = {
    FREE: Shield,
    BETA: Zap,
    ALFA: Crown,
    CUSTOM: Sparkles,
};

export default function BillingPage() {
    const searchParams = useSearchParams();
    const [plans, setPlans] = useState<PlanData[]>([]);
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const sessionId = searchParams?.get('session_id');
        if (searchParams?.get('success') === 'true' && sessionId) {
            // Verify the checkout session and upgrade the plan
            api.verifyCheckout(sessionId)
                .then(() => {
                    toast.success('Plan upgraded successfully!');
                    loadData();
                })
                .catch((err: any) => {
                    console.error('Verify checkout error:', err);
                    toast.error('Failed to verify upgrade. Please refresh.');
                    loadData();
                });
        }
        if (searchParams?.get('cancelled') === 'true') {
            toast('Upgrade cancelled', { icon: '↩️' });
        }
    }, [searchParams]);

    const loadData = async () => {
        try {
            const [plansData, subData] = await Promise.all([
                api.getPlans(),
                api.getSubscription(),
            ]);
            setPlans(plansData);
            setSubscription(subData);
        } catch (error) {
            console.error('Failed to load billing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (planName: string) => {
        setUpgrading(planName);
        try {
            const { checkout_url } = await api.createCheckoutSession(planName);
            window.location.href = checkout_url;
        } catch (error: any) {
            toast.error(error.message || 'Failed to start checkout');
            setUpgrading(null);
        }
    };

    const formatLimit = (value: number | null) => {
        if (value === null) return '∞';
        return value.toLocaleString();
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    const currentPlan = subscription?.plan_name || 'FREE';
    const chatbotsPercent = subscription
        ? subscription.chatbots_max
            ? Math.min((subscription.chatbots_used / subscription.chatbots_max) * 100, 100)
            : 5
        : 0;

    return (
        <div className="max-w-5xl mx-auto px-6 py-10">
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Billing & Plans</h1>
                        <p className="text-sm text-dark-400">Manage your subscription and usage</p>
                    </div>
                </div>
            </div>

            {/* Current Plan + Usage */}
            {subscription && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                    {/* Current Plan Card */}
                    <div className={`rounded-xl border ${PLAN_COLORS[currentPlan]?.border || 'border-dark-700'} ${PLAN_COLORS[currentPlan]?.bg || 'bg-dark-800/50'} p-5`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[currentPlan]?.badge || 'bg-dark-700 text-dark-300'}`}>
                                Current Plan
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{currentPlan}</h3>
                        <p className="text-2xl font-bold text-white">
                            ${subscription.plan_price}
                            <span className="text-sm font-normal text-dark-500">/mo</span>
                        </p>
                    </div>

                    {/* Chatbots Usage */}
                    <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Bot className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-semibold text-dark-400">Chatbots</span>
                        </div>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-xl font-bold text-white">{subscription.chatbots_used}</span>
                            <span className="text-sm text-dark-500">/ {formatLimit(subscription.chatbots_max)}</span>
                        </div>
                        <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500"
                                style={{ width: `${chatbotsPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Plans Grid */}
            <h2 className="text-lg font-bold text-white mb-5">Compare Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {plans.map((plan) => {
                    const colors = PLAN_COLORS[plan.name] || PLAN_COLORS.FREE;
                    const Icon = PLAN_ICONS[plan.name] || Shield;
                    const isCurrent = currentPlan === plan.name;
                    const isUpgrade = plan.price_monthly > (subscription?.plan_price || 0);
                    const isCustom = plan.name === 'CUSTOM';

                    return (
                        <div
                            key={plan.id}
                            className={`rounded-xl border ${isCurrent ? colors.border : 'border-dark-700'} ${isCurrent ? colors.bg : 'bg-dark-900'
                                } p-5 flex flex-col relative overflow-hidden transition-all hover:border-dark-600`}
                        >
                            {isCurrent && (
                                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.gradient}`} />
                            )}

                            <div className="flex items-center gap-2.5 mb-4">
                                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}>
                                    <Icon className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">{plan.name}</h3>
                                    {isCurrent && (
                                        <span className="text-[10px] text-dark-500">Current</span>
                                    )}
                                </div>
                            </div>

                            <div className="mb-5">
                                {isCustom ? (
                                    <p className="text-xl font-bold text-white">Custom</p>
                                ) : (
                                    <p className="text-2xl font-bold text-white">
                                        ${plan.price_monthly}
                                        <span className="text-sm font-normal text-dark-500">/mo</span>
                                    </p>
                                )}
                            </div>

                            <ul className="space-y-2.5 mb-6 flex-1">
                                <li className="flex items-center gap-2 text-xs text-dark-300">
                                    <Bot className="w-3.5 h-3.5 text-dark-500 flex-shrink-0" />
                                    <span>{plan.max_chatbots ? `${plan.max_chatbots} chatbot${plan.max_chatbots > 1 ? 's' : ''}` : 'Unlimited chatbots'}</span>
                                </li>
                                <li className="flex items-center gap-2 text-xs">
                                    {plan.allow_whatsapp ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                            <span className="text-dark-300">WhatsApp</span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-3.5 h-3.5 text-dark-600 flex-shrink-0" />
                                            <span className="text-dark-600">WhatsApp</span>
                                        </>
                                    )}
                                </li>
                                <li className="flex items-center gap-2 text-xs">
                                    {plan.allow_google_sync ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                            <span className="text-dark-300">Google Sheets</span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-3.5 h-3.5 text-dark-600 flex-shrink-0" />
                                            <span className="text-dark-600">Google Sheets</span>
                                        </>
                                    )}
                                </li>
                            </ul>

                            {isCurrent ? (
                                <div className="w-full px-4 py-2.5 rounded-lg bg-dark-700/50 text-center text-dark-400 text-sm font-medium">
                                    Current Plan
                                </div>
                            ) : isCustom ? (
                                <a
                                    href="mailto:support@docubot.ai"
                                    className="w-full px-4 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium
                                        hover:bg-amber-500/20 transition-all text-center flex items-center justify-center gap-1.5 border border-amber-500/20"
                                >
                                    Contact Sales
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </a>
                            ) : isUpgrade ? (
                                <button
                                    onClick={() => handleUpgrade(plan.name)}
                                    disabled={upgrading === plan.name}
                                    className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium
                                        transition-all disabled:opacity-50 disabled:cursor-not-allowed
                                        flex items-center justify-center gap-1.5
                                        bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90`}
                                >
                                    {upgrading === plan.name ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            Upgrade
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="w-full px-4 py-2.5 rounded-lg bg-dark-800 text-center text-dark-500 text-sm font-medium">
                                    Included
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Features Comparison Table */}
            <div className="rounded-xl border border-dark-700 bg-dark-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-800">
                    <h3 className="text-sm font-bold text-white">Feature Comparison</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-dark-800">
                                <th className="text-left px-5 py-3 text-dark-500 font-medium">Feature</th>
                                {plans.map((p) => (
                                    <th key={p.id} className="px-4 py-3 text-center">
                                        <span className={`text-xs font-semibold ${currentPlan === p.name ? 'text-brand-400' : 'text-dark-300'}`}>
                                            {p.name}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-dark-800/50">
                                <td className="px-5 py-3 text-dark-400">Max Chatbots</td>
                                {plans.map((p) => (
                                    <td key={p.id} className="px-4 py-3 text-center text-dark-300">
                                        {formatLimit(p.max_chatbots)}
                                    </td>
                                ))}
                            </tr>
                            <tr className="border-b border-dark-800/50">
                                <td className="px-5 py-3 text-dark-400">WhatsApp Integration</td>
                                {plans.map((p) => (
                                    <td key={p.id} className="px-4 py-3 text-center">
                                        {p.allow_whatsapp ? (
                                            <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                        ) : (
                                            <X className="w-4 h-4 text-dark-600 mx-auto" />
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr className="border-b border-dark-800/50">
                                <td className="px-5 py-3 text-dark-400">Google Sheets Sync</td>
                                {plans.map((p) => (
                                    <td key={p.id} className="px-4 py-3 text-center">
                                        {p.allow_google_sync ? (
                                            <Check className="w-4 h-4 text-emerald-400 mx-auto" />
                                        ) : (
                                            <X className="w-4 h-4 text-dark-600 mx-auto" />
                                        )}
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td className="px-5 py-3 text-dark-400">Price</td>
                                {plans.map((p) => (
                                    <td key={p.id} className="px-4 py-3 text-center font-semibold text-dark-300">
                                        {p.name === 'CUSTOM' ? 'Custom' : p.price_monthly === 0 ? 'Free' : `$${p.price_monthly}`}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
