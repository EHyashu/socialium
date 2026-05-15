"use client";

import { CreditCard, Check, Zap } from "lucide-react";
import { getStoredUser } from "@/lib/auth";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    features: [
      "1 workspace",
      "1 team member",
      "2 platform connections",
      "10 scheduled posts",
      "5 AI generations/day",
      "7 days analytics",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    popular: true,
    features: [
      "3 workspaces",
      "5 team members",
      "5 platform connections",
      "50 scheduled posts",
      "50 AI generations/day",
      "90 days analytics",
      "A/B testing",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$99",
    period: "/month",
    features: [
      "10 workspaces",
      "20 team members",
      "15 platform connections",
      "500 scheduled posts",
      "500 AI generations/day",
      "365 days analytics",
      "A/B testing",
      "Priority support",
    ],
  },
];

export default function BillingPage() {
  const user = getStoredUser();
  const currentTier = user?.subscription_tier || "free";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
        <p className="text-sm text-gray-500 mt-1">
          You&apos;re currently on the <span className="font-medium capitalize">{currentTier}</span> plan
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentTier;
          return (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-6 ${
                plan.popular
                  ? "border-brand-300 bg-brand-50/30 shadow-sm"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-medium text-white">
                  Most Popular
                </span>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>
              </div>

              <ul className="mb-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                disabled={isCurrent}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : plan.popular
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {isCurrent ? "Current Plan" : "Upgrade"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment method */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Payment Method</h2>
        <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-4">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <p className="text-sm text-gray-600">
            No payment method on file.{" "}
            <button className="font-medium text-brand-600 hover:text-brand-700">
              Add one
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
