import { Link } from 'react-router-dom'
import { LegalPageShell } from '../features/legal/LegalPageShell'

const EFFECTIVE_DATE = 'May 8, 2026'

const sectionTitle = 'mt-12 text-xl font-semibold tracking-tight text-white first:mt-0'
const subTitle = 'mt-6 text-lg font-medium text-white/95'
const body = 'mt-3 text-sm leading-7 text-slate-300'
const list = 'mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-300'

export function TermsOfServicePage() {
  return (
    <LegalPageShell>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <article className="rounded-[2.2rem] bg-[rgba(7,12,16,0.58)] p-8 shadow-[0_18px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Terms &amp; Conditions
          </h1>
          <p className={`${body} mt-4 text-slate-400`}>
            Effective date: <time dateTime="2026-05-08">{EFFECTIVE_DATE}</time>
          </p>

          <div
            className={`${body} mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-slate-200`}
            role="note"
          >
            <p className="font-medium text-white">
              RAYD8® is not a medical device and is not intended to diagnose, treat, cure, or prevent any
              disease.
            </p>
            <p className={`${body} mt-3 border-none p-0`}>
              RAYD8 is a digital wellness experience—ambient immersive playback and visual resonance-style
              content—for relaxation and focus. It is provided for personal, non-clinical use only.
            </p>
          </div>

          <section aria-labelledby="terms-accept">
            <h2 className={sectionTitle} id="terms-accept">
              Acceptance of terms
            </h2>
            <p className={body}>
              These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of the RAYD8®
              website and services operated by ANOINT Inc. (&quot;ANOINT,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) at{' '}
              <a
                className="text-emerald-200/90 underline decoration-emerald-400/40 underline-offset-4 hover:text-emerald-100"
                href="https://rayd8.app"
                rel="noreferrer"
                target="_blank"
              >
                https://rayd8.app
              </a>
              . By accessing or using RAYD8, you agree to these Terms and our Privacy Policy. If you do not
              agree, please discontinue use.
            </p>
          </section>

          <section aria-labelledby="terms-eligibility">
            <h2 className={sectionTitle} id="terms-eligibility">
              Eligibility
            </h2>
            <p className={body}>
              You must be able to form a binding contract in your jurisdiction and meet any minimum age
              requirements that apply where you live. If you use RAYD8 on behalf of an organization, you
              represent that you have authority to bind that organization.
            </p>
          </section>

          <section aria-labelledby="terms-account">
            <h2 className={sectionTitle} id="terms-account">
              Account responsibilities
            </h2>
            <p className={body}>
              You are responsible for safeguarding your login credentials and for activity under your
              account. Notify us promptly through the contact options on the website if you suspect
              unauthorized access. We may rely on account instructions that appear legitimate.
            </p>
          </section>

          <section aria-labelledby="terms-billing">
            <h2 className={sectionTitle} id="terms-billing">
              Subscriptions and billing
            </h2>
            <p className={body}>
              Paid plans, renewals, and payment processing may be handled through Stripe or another
              authorized processor. Fees, renewal intervals, and cancellation mechanics are presented at
              checkout or in your account where applicable. Taxes may apply based on your location.
            </p>
            <h3 className={subTitle}>Free trials</h3>
            <p className={body}>
              If we offer a free trial, its duration and limits will be described when you enroll. Unless we
              state otherwise, converting to a paid plan or continuing past the trial period may result in
              charges according to the plan you select.
            </p>
          </section>

          <section aria-labelledby="terms-service">
            <h2 className={sectionTitle} id="terms-service">
              Playback and service availability
            </h2>
            <p className={body}>
              We strive to deliver a reliable immersive experience, but streaming quality depends on your
              device, browser, and network. Features may change, maintenance may occur, and uninterrupted
              uptime is not guaranteed. We may modify, suspend, or discontinue parts of the service with
              reasonable notice where practicable.
            </p>
          </section>

          <section aria-labelledby="terms-aup">
            <h2 className={sectionTitle} id="terms-aup">
              Acceptable use
            </h2>
            <p className={body}>You agree not to:</p>
            <ul className={list}>
              <li>Violate applicable law or infringe others&apos; rights</li>
              <li>Attempt to disrupt, overload, or reverse engineer the service beyond permitted use</li>
              <li>Use RAYD8 to build competing scraping datasets or redistribute streams at scale</li>
              <li>Misrepresent your identity or affiliation</li>
              <li>Use the service in any way that places unreasonable burden on our infrastructure</li>
            </ul>
          </section>

          <section aria-labelledby="terms-ip">
            <h2 className={sectionTitle} id="terms-ip">
              Intellectual property
            </h2>
            <p className={body}>
              RAYD8®, related branding, visual assets, audio-visual content, software, and documentation are
              owned by ANOINT Inc. or its licensors and are protected by intellectual property laws. We grant
              you a limited, personal, non-exclusive, non-transferable license to access and use the service
              for its intended experiential purpose. No ownership rights are transferred to you.
            </p>
          </section>

          <section aria-labelledby="terms-experimental">
            <h2 className={sectionTitle} id="terms-experimental">
              Experiential nature of RAYD8
            </h2>
            <p className={body}>
              RAYD8 offers ambient, immersive digital experiences intended for relaxation and focus.
              Individual responses vary; subjective feelings or perceptions during or after use are not
              predictable outcomes and do not constitute evidence of a medical or therapeutic effect.
            </p>
          </section>

          <section aria-labelledby="terms-disclaimer">
            <h2 className={sectionTitle} id="terms-disclaimer">
              Disclaimers
            </h2>
            <p className={body}>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT
              PERMITTED BY LAW, WE DISCLAIM IMPLIED WARRANTIES SUCH AS MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT, EXCEPT WHERE SUCH DISCLAIMERS ARE NOT ALLOWED BY
              LAW.
            </p>
            <p className={body}>
              We do not guarantee specific wellness results, emotional outcomes, or performance benchmarks.
              You remain responsible for your own wellness choices and for seeking professional advice when
              appropriate.
            </p>
          </section>

          <section aria-labelledby="terms-liability">
            <h2 className={sectionTitle} id="terms-liability">
              Limitation of liability
            </h2>
            <p className={body}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ANOINT INC. AND ITS AFFILIATES WILL NOT BE
              LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF
              PROFITS, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF RAYD8, EVEN IF ADVISED OF
              THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className={body}>
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE WILL NOT EXCEED
              THE GREATER OF (A) THE AMOUNTS YOU PAID TO US FOR THE SERVICE IN THE THREE (3) MONTHS BEFORE THE
              EVENT GIVING RISE TO LIABILITY OR (B) ONE HUNDRED U.S. DOLLARS (USD $100), EXCEPT WHERE LAW
              REQUIRES OTHERWISE.
            </p>
          </section>

          <section aria-labelledby="terms-termination">
            <h2 className={sectionTitle} id="terms-termination">
              Termination and suspension
            </h2>
            <p className={body}>
              You may stop using RAYD8 at any time. We may suspend or terminate access if we reasonably
              believe these Terms have been violated, if necessary for security or legal reasons, or if we
              wind down the service. Provisions that by their nature should survive will remain in effect.
            </p>
          </section>

          <section aria-labelledby="terms-changes">
            <h2 className={sectionTitle} id="terms-changes">
              Changes to the service or terms
            </h2>
            <p className={body}>
              We may update these Terms to reflect product, legal, or operational changes. When we do, we
              will update the effective date and, where appropriate, provide additional notice. Continued use
              after changes become effective constitutes acceptance of the revised Terms.
            </p>
          </section>

          <section aria-labelledby="terms-law">
            <h2 className={sectionTitle} id="terms-law">
              Governing law
            </h2>
            <p className={body}>
              These Terms are governed by the laws applicable in the jurisdiction where ANOINT Inc.
              maintains its principal place of business, without regard to conflict-of-law principles that
              would require applying another jurisdiction&apos;s laws. Courts in that jurisdiction will have
              exclusive venue for disputes, unless applicable consumer protection rules require otherwise.
            </p>
          </section>

          <section aria-labelledby="terms-contact">
            <h2 className={sectionTitle} id="terms-contact">
              Contact
            </h2>
            <p className={body}>
              For questions about these Terms, contact ANOINT Inc. through the contact options on our
              website:
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
              to="/privacy"
            >
              Privacy Policy →
            </Link>
          </nav>
        </article>
      </div>
    </LegalPageShell>
  )
}
