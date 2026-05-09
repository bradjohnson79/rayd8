import { Link } from 'react-router-dom'
import { LegalPageShell } from '../features/legal/LegalPageShell'

const EFFECTIVE_DATE = 'May 8, 2026'

const sectionTitle = 'mt-12 text-xl font-semibold tracking-tight text-white first:mt-0'
const body = 'mt-3 text-sm leading-7 text-slate-300'
const list = 'mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-300'

export function PrivacyPolicyPage() {
  return (
    <LegalPageShell>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <article className="rounded-[2.2rem] bg-[rgba(7,12,16,0.58)] p-8 shadow-[0_18px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Privacy Policy
          </h1>
          <p className={`${body} mt-4 text-slate-400`}>
            Effective date: <time dateTime="2026-05-08">{EFFECTIVE_DATE}</time>
          </p>

          <p className={`${body} mt-6 border-l-2 border-emerald-400/30 pl-4 text-slate-200`}>
            RAYD8® is an experiential digital wellness platform operated by ANOINT Inc. (&quot;we,&quot;
            &quot;us,&quot; or &quot;our&quot;) at{' '}
            <a
              className="text-emerald-200/90 underline decoration-emerald-400/40 underline-offset-4 hover:text-emerald-100"
              href="https://rayd8.app"
              rel="noreferrer"
              target="_blank"
            >
              https://rayd8.app
            </a>
            . It is not intended for medical use, and we do not collect health records or diagnostic
            information as part of the service.
          </p>

          <section aria-labelledby="privacy-intro">
            <h2 className={sectionTitle} id="privacy-intro">
              Introduction
            </h2>
            <p className={body}>
              This Privacy Policy describes how we collect, use, store, and share information when you
              visit our website, create an account, purchase a subscription, or use the RAYD8 playback
              experience. We aim to be transparent and to handle personal information responsibly.
            </p>
          </section>

          <section aria-labelledby="privacy-collect">
            <h2 className={sectionTitle} id="privacy-collect">
              Information we collect
            </h2>
            <p className={body}>
              Depending on how you use RAYD8, we may collect account identifiers, contact details,
              billing-related references, technical logs, and usage information needed to operate and
              improve the service. We do not ask you to submit medical histories, diagnoses, or treatment
              information, and the platform is not designed to capture clinical data.
            </p>
          </section>

          <section aria-labelledby="privacy-account">
            <h2 className={sectionTitle} id="privacy-account">
              Account information
            </h2>
            <p className={body}>
              Authentication and account management are provided by Clerk Technologies, Inc.
              (&quot;Clerk&quot;). When you sign up or sign in, Clerk may process information such as your
              email address, name (if provided), session tokens, and security-related metadata according to
              Clerk&apos;s own privacy practices. We receive what is necessary to recognize your account
              inside RAYD8.
            </p>
          </section>

          <section aria-labelledby="privacy-payment">
            <h2 className={sectionTitle} id="privacy-payment">
              Payment processing
            </h2>
            <p className={body}>
              Payments and subscriptions are processed by Stripe, Inc. Card details and full payment
              credentials are handled directly by Stripe; we typically receive limited billing metadata
              (for example, subscription status and transaction references) rather than storing complete
              card numbers on our servers. Stripe&apos;s use of information is governed by Stripe&apos;s
              policies.
            </p>
          </section>

          <section aria-labelledby="privacy-analytics">
            <h2 className={sectionTitle} id="privacy-analytics">
              Usage and session analytics
            </h2>
            <p className={body}>
              We may use privacy-conscious analytics to understand how the site and product are used—for
              example, page views, general geography at a coarse level, and technical metrics that help us
              improve reliability. Where optional diagnostics are enabled for troubleshooting (such as
              engineering playback diagnostics), they are intended for operational insight, not for medical
              assessment.
            </p>
          </section>

          <section aria-labelledby="privacy-cookies">
            <h2 className={sectionTitle} id="privacy-cookies">
              Cookies and local storage
            </h2>
            <p className={body}>
              We and our service providers may use cookies, similar technologies, and browser local storage
              to keep you signed in, remember preferences, reduce fraud, and measure performance. You can
              control cookies through your browser settings; disabling certain cookies may limit sign-in or
              playback features.
            </p>
          </section>

          <section aria-labelledby="privacy-playback">
            <h2 className={sectionTitle} id="privacy-playback">
              Playback and session telemetry
            </h2>
            <p className={body}>
              Streaming delivery may rely on Mux, Inc. (&quot;Mux&quot;) or similar infrastructure. Technical
              data associated with delivering video and audio (such as device capabilities, network
              conditions, and playback tokens) may be processed to provide a stable viewing experience.
              This information supports streaming operations and quality monitoring—not medical evaluation.
            </p>
          </section>

          <section aria-labelledby="privacy-third">
            <h2 className={sectionTitle} id="privacy-third">
              Third-party services
            </h2>
            <p className={body}>
              We integrate with vendors we believe are appropriate for authentication, payments,
              streaming, hosting, email, and analytics. Each provider processes information under its own
              terms. We encourage you to review their privacy notices if you want additional detail.
            </p>
            <ul className={list}>
              <li>Clerk — authentication and user sessions</li>
              <li>Stripe — payments and subscriptions</li>
              <li>Mux — secure streaming delivery where applicable</li>
              <li>Infrastructure and tooling providers that host or support our applications</li>
            </ul>
          </section>

          <section aria-labelledby="privacy-security">
            <h2 className={sectionTitle} id="privacy-security">
              How we protect information
            </h2>
            <p className={body}>
              We use administrative, technical, and organizational measures designed to protect personal
              information against unauthorized access, loss, or misuse. No method of transmission over the
              Internet is completely secure; we work to keep practices current as threats evolve.
            </p>
          </section>

          <section aria-labelledby="privacy-sale">
            <h2 className={sectionTitle} id="privacy-sale">
              We do not sell your personal data
            </h2>
            <p className={body}>
              We do not sell your personal information for money. We may share information with service
              providers who process it on our behalf under contractual obligations, or when required by law,
              as described in this policy.
            </p>
          </section>

          <section aria-labelledby="privacy-rights">
            <h2 className={sectionTitle} id="privacy-rights">
              Your choices and rights
            </h2>
            <p className={body}>
              Depending on where you live, you may have rights to access, correct, delete, or export certain
              personal information, or to object to or restrict particular processing. You may also have the
              right to lodge a complaint with a supervisory authority. To exercise rights that apply to
              you, contact us using the information below. We will respond consistent with applicable law.
            </p>
          </section>

          <section aria-labelledby="privacy-children">
            <h2 className={sectionTitle} id="privacy-children">
              Children&apos;s privacy
            </h2>
            <p className={body}>
              RAYD8 is not directed to children, and we do not knowingly collect personal information from
              children under the age where parental consent is required in their jurisdiction. If you believe
              we have collected information from a child in error, please contact us and we will take
              appropriate steps.
            </p>
          </section>

          <section aria-labelledby="privacy-changes">
            <h2 className={sectionTitle} id="privacy-changes">
              Changes to this policy
            </h2>
            <p className={body}>
              We may update this Privacy Policy from time to time. When we do, we will revise the effective
              date at the top and, where appropriate, provide additional notice (such as a notice on the
              website or in your account). Continued use of RAYD8 after changes means you acknowledge the
              updated policy.
            </p>
          </section>

          <section aria-labelledby="privacy-contact">
            <h2 className={sectionTitle} id="privacy-contact">
              Contact us
            </h2>
            <p className={body}>
              Questions about this Privacy Policy or our privacy practices may be directed to ANOINT Inc.
              through the contact options on our website:
            </p>
            <p className={body}>
              <Link
                className="text-emerald-200/90 underline decoration-emerald-400/40 underline-offset-4 hover:text-emerald-100"
                to="/#contact-form"
              >
                RAYD8 contact form
              </Link>{' '}
              (rayd8.app)
            </p>
          </section>

          <nav aria-label="Related policies" className="mt-12 border-t border-white/10 pt-8">
            <Link
              className="text-sm font-medium text-emerald-200/90 hover:text-emerald-100"
              to="/terms"
            >
              Terms &amp; Conditions →
            </Link>
          </nav>
        </article>
      </div>
    </LegalPageShell>
  )
}
