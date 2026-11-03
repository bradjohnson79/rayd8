import type { ReactNode } from 'react'
import { AMRITA_PRICE_LINE, amritaTierFeatures, regenTierFeatures } from '../amrita/amritaContent'
import { Section } from './components/Section'

/**
 * Pricing lines are copied from the public plan cards and member dashboard.
 * Do not collapse the Amrita hour lines into one claim. See the PR notes.
 */
const FREE_TRIAL_HOURS = [
  '35 total hours during your 30-day free trial',
  'One-time trial window with no monthly reset',
  'Expansion version + 1 hour access to Premium & REGEN versions each',
] as const

const FREE_TRIAL_DASHBOARD_HOURS = [
  'Free Trial members can explore Expansion for up to 33 hours during the one-time trial.',
  'Free Trial members can sample Premium for one hour during the one-time trial.',
  'Free Trial members can sample REGEN for one hour during the one-time trial.',
] as const

const FREE_TRIAL_VERSIONS = [
  'Expansion version + 1 hour access to Premium & REGEN versions each',
  '720p quality',
  'Works on any device',
] as const

const REGEN_PRICE_LINE = 'Only $19.99 USD Per Month'
const FREE_TRIAL_PRICE_LINE = 'No payment required'

const AMRITA_HOUR_LINES = ['500 Hours', '500 Monthly Hours', 'Unlimited AMRITA'] as const

function CellList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export function PlansAndFaqSection({ reducedEffects = false }: { reducedEffects?: boolean }) {
  return (
    <>
      <Section
        description="Hours, included versions, and price as already published on the plan cards."
        eyebrow="Plans"
        id="plans"
        reducedEffects={reducedEffects}
        title="Compare Free Trial, REGEN, and Amrita"
      >
        <div className="overflow-x-auto rounded-[1.8rem] border border-white/10">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm text-slate-200">
            <caption className="sr-only">
              Free Trial, REGEN, and Amrita compared by hours, included versions, and price
            </caption>
            <thead className="bg-white/[0.04] text-white">
              <tr>
                <th className="px-4 py-4 font-medium" scope="col">
                  <span className="sr-only">Detail</span>
                </th>
                <th className="px-4 py-4 font-semibold" scope="col">
                  Free Trial
                </th>
                <th className="px-4 py-4 font-semibold" scope="col">
                  REGEN
                </th>
                <th className="px-4 py-4 font-semibold" scope="col">
                  Amrita
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/10 align-top">
                <th className="px-4 py-4 font-medium text-white" scope="row">
                  Hours
                </th>
                <td className="px-4 py-4 leading-6">
                  <CellList items={FREE_TRIAL_HOURS} />
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                    Member dashboard
                  </p>
                  <div className="mt-2">
                    <CellList items={FREE_TRIAL_DASHBOARD_HOURS} />
                  </div>
                </td>
                <td className="px-4 py-4 leading-6">250 Hours</td>
                <td className="px-4 py-4 leading-6">
                  <CellList items={AMRITA_HOUR_LINES} />
                </td>
              </tr>
              <tr className="border-t border-white/10 align-top">
                <th className="px-4 py-4 font-medium text-white" scope="row">
                  Included versions
                </th>
                <td className="px-4 py-4 leading-6">
                  <CellList items={FREE_TRIAL_VERSIONS} />
                </td>
                <td className="px-4 py-4 leading-6">
                  <CellList items={regenTierFeatures.filter((feature) => feature !== '250 Hours')} />
                </td>
                <td className="px-4 py-4 leading-6">
                  <CellList items={amritaTierFeatures.filter((feature) => feature !== '500 Hours')} />
                </td>
              </tr>
              <tr className="border-t border-white/10 align-top">
                <th className="px-4 py-4 font-medium text-white" scope="row">
                  Price
                </th>
                <td className="px-4 py-4 font-medium text-white">{FREE_TRIAL_PRICE_LINE}</td>
                <td className="px-4 py-4 font-medium text-white">{REGEN_PRICE_LINE}</td>
                <td className="px-4 py-4 font-medium text-white">{AMRITA_PRICE_LINE}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Amrita publishes both “500 Hours” and “500 Monthly Hours,” and also “Unlimited AMRITA.” Those
          lines are shown together here.
        </p>
      </Section>

      <Section
        description="Answers below use the plan cards, account settings, and terms. Nothing here adds a policy that is not already written."
        eyebrow="FAQ"
        id="faq"
        reducedEffects={reducedEffects}
        showBackToTop
        title="Questions about plans"
      >
        <div className="space-y-3">
          <FaqItem title="What does the Free Trial include?">
            <p>35 total hours during your 30-day free trial. It is a one-time trial window with no monthly reset.</p>
            <p className="mt-3">
              Expansion version + 1 hour access to Premium &amp; REGEN versions each. The landing plan card also
              lists 720p quality and says it works on any device. No payment required. Instant access after sign-in.
            </p>
          </FaqItem>
          <FaqItem title="What does REGEN include, and what does it cost?">
            <p>250 Hours, Expansion, Premium, REGEN, and HAMSA Access.</p>
            <p className="mt-3">Only $19.99 USD Per Month. Secure checkout powered by Stripe.</p>
          </FaqItem>
          <FaqItem title="What does Amrita include, and what does it cost?">
            <p>
              The plan card lists 500 Hours, Expansion, Premium, REGEN, Unlimited HAMSA, Unlimited AMRITA, and Full
              Ecosystem Access.
            </p>
            <p className="mt-3">
              Membership benefits also say 500 Monthly Hours, Unlimited HAMSA, and Unlimited AMRITA. The published
              price is {AMRITA_PRICE_LINE}.
            </p>
          </FaqItem>
          <FaqItem title="How does cancellation work?">
            <p>
              Subscribed members can pause access for 1 month or schedule cancellation from account settings. Access
              continues until the end of the current billing period after cancellation is confirmed.
            </p>
            <p className="mt-3">
              The terms say fees, renewal intervals, and cancellation mechanics are presented at checkout or in your
              account. You may stop using RAYD8 at any time.
            </p>
          </FaqItem>
          <FaqItem title="Refunds — TODO for Brad">
            <p>
              TODO for Brad: the terms and billing screens do not state a refund policy. Do not publish a refund
              promise until you write the approved wording. This answer is unfinished on purpose.
            </p>
            <p className="mt-3">
              What the product currently says is only about cancellation: access continues until the end of the
              current billing period after cancellation is confirmed, and the terms point people to checkout or the
              account for cancellation mechanics.
            </p>
          </FaqItem>
        </div>
      </Section>
    </>
  )
}

function FaqItem({ children, title }: { children: ReactNode; title: string }) {
  return (
    <details className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-5 py-4">
      <summary className="cursor-pointer text-base font-medium text-white">{title}</summary>
      <div className="mt-3 text-sm leading-7 text-slate-300">{children}</div>
    </details>
  )
}
