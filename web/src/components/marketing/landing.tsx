import Link from "next/link";
import { FillBtn } from "@/components/marketing/fill-btn";
import { SplitLines } from "@/components/marketing/motion";
import { messages } from "@/lib/messages";
import { HX } from "@/lib/visuals";

const TICKER = [
  messages.landingTicker1,
  messages.landingTicker2,
  messages.landingTicker3,
] as const;

const PROBLEMS = [
  { num: "01", tag: "Manual", title: messages.landingProblemHead1, body: messages.landingProblem1 },
  { num: "02", tag: "Disjointed", title: messages.landingProblemHead2, body: messages.landingProblem2 },
  { num: "03", tag: "Blind", title: messages.landingProblemHead3, body: messages.landingProblem3 },
  { num: "04", tag: "Slow", title: messages.landingProblemHead4, body: messages.landingProblem4 },
] as const;

const WHY = [
  { title: messages.landingWhyObserve, body: messages.landingWhyObserveBody },
  { title: messages.landingWhyAdvise, body: messages.landingWhyAdviseBody },
  { title: messages.landingWhyAct, body: messages.landingWhyActBody },
  { title: messages.landingWhyLearn, body: messages.landingWhyLearnBody },
] as const;

const PEOPLE = [
  { src: HX.peopleArchitects, label: messages.landingRoleAdmin },
  { src: HX.peopleInterior, label: messages.landingRolePm },
  { src: HX.peopleDrafters, label: messages.landingRoleField },
  { src: HX.peopleEngineers, label: messages.landingRoleCustomer },
] as const;

function Plus() {
  return (
    <>
      <i className="hx-plus top left" />
      <i className="hx-plus top right" />
      <i className="hx-plus bot left" />
      <i className="hx-plus bot right" />
    </>
  );
}

export function LandingPage() {
  const ticker = [...TICKER, ...TICKER, ...TICKER, ...TICKER];
  return (
    <main>
      <section className="hx-hero">
        <div className="hx-hero-visual">
          <img src={HX.hero} alt="" />
          <div className="hx-pin" style={{ top: "16%", left: "11%" }}>
            <b>{messages.landingCallout1Title}</b>
            {messages.landingCallout1Body}
          </div>
          <div className="hx-pin" style={{ top: "38%", right: "14%" }}>
            <b>{messages.landingCallout2Title}</b>
            {messages.landingCallout2Body}
          </div>
          <div className="hx-pin" style={{ bottom: "14%", left: "22%" }}>
            <b>{messages.landingCallout3Title}</b>
            {messages.landingCallout3Body}
          </div>
        </div>
        <div className="hx-hero-band">
          <i className="hx-hline top" />
          <i className="hx-hline bot" />
          <div className="hx-hero-title">
            <SplitLines as="h1" text={messages.landingHeadline} />
          </div>
          <div className="hx-hero-sub">
            <div className="hx-hero-sub-row">
              <p>{messages.landingSubhead}</p>
              <FillBtn href="/signup" variant="hero">
                {messages.landingDiscover}
              </FillBtn>
            </div>
            <div className="hx-ticker" aria-hidden>
              <div className="hx-ticker-track">
                {ticker.map((item, i) => (
                  <span key={`${item}-${i}`}>
                    <i />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="hx-intro" id="intro">
        <div className="hx-intro-img">
          <img src={HX.heroDetail} alt="" />
        </div>
        <div className="hx-intro-body">
          <SplitLines as="h2" text={messages.landingIntroLead} />
        </div>
        <div className="hx-intro-foot">
          <FillBtn href="/pricing" variant="outline">
            {messages.landingLearnMore}
          </FillBtn>
          <p className="hx-kicker">{messages.landingClientsLabel}</p>
          <p className="hx-native">{messages.landingNativeLine}</p>
        </div>
      </section>

      <section className="hx-problems-wrap">
        <div className="hx-problems-head">
          <p className="hx-kicker">{messages.landingProblemKicker}</p>
          <SplitLines as="h2" text={messages.landingProblemTitle} />
        </div>
        <div className="hx-problems">
          {PROBLEMS.map((item) => (
            <article key={item.num} className="hx-problem">
              <Plus />
              <div className="hx-problem-head">
                <span>{item.tag}</span>
                <span className="hx-num">{item.num}</span>
              </div>
              <div className="hx-problem-fig" aria-hidden>
                <img src={HX.floor} alt="" />
              </div>
              <div className="hx-problem-copy">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="hx-map" id="map" data-hx-map>
        <div className="hx-map-sticky">
          <div className="hx-map-copy">
            <p className="hx-kicker">{messages.landingMapKicker}</p>
            <SplitLines as="h2" text={messages.landingMapTitle} />
            <p>{messages.landingMapIntro}</p>
            <p className="hx-kicker">{messages.landingMapHint}</p>
            <ul className="hx-map-steps">
              <li>{messages.landingCallout1Title}</li>
              <li>{messages.landingCallout2Title}</li>
              <li>{messages.landingCallout3Title}</li>
            </ul>
          </div>
          <div className="hx-map-visual">
            <img src={HX.plan} alt="" />
            <div className="hx-map-card" data-hx-pin style={{ top: "14%", left: "10%" }}>
              <strong>{messages.landingCallout1Title}</strong>
              {messages.landingCallout1Body}
            </div>
            <div className="hx-map-card" data-hx-pin style={{ top: "42%", right: "8%" }}>
              <strong>{messages.landingCallout2Title}</strong>
              {messages.landingCallout2Body}
            </div>
            <div className="hx-map-card" data-hx-pin style={{ bottom: "12%", left: "16%" }}>
              <strong>{messages.landingCallout3Title}</strong>
              {messages.landingCallout3Body}
            </div>
          </div>
        </div>
      </section>

      <section className="hx-platform" id="platform">
        <article className="hx-pane">
          <p className="hx-kicker">[01]</p>
          <img src={HX.chat} alt="" />
          <SplitLines as="h2" text={messages.landingPlatformOne} />
          <p>{messages.landingPlatformOneBody}</p>
          <FillBtn href="/signup" variant="outline">
            {messages.landingLearnMore}
          </FillBtn>
        </article>
        <article className="hx-pane">
          <p className="hx-kicker">[02]</p>
          <img src={HX.dashboard} alt="" />
          <SplitLines as="h2" text={messages.landingPlatformTwo} />
          <p>{messages.landingPlatformTwoBody}</p>
          <FillBtn href="/login" variant="outline">
            {messages.landingLearnMore}
          </FillBtn>
        </article>
      </section>

      <section>
        <div className="hx-use-head">
          <SplitLines as="h2" text={messages.landingWhyTitle} />
        </div>
        <div className="hx-why">
          {WHY.map((item) => (
            <article key={item.title} className="hx-why-item">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="hx-use-head">
          <SplitLines as="h2" text={messages.landingUseTitle} />
        </div>
        <div className="hx-use">
          {PEOPLE.map((item) => (
            <article key={item.label} className="hx-use-card">
              <img src={item.src} alt="" />
              <span>{item.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="hx-cta-band">
        <img src={HX.cta} alt="" />
        <div className="hx-cta-band-copy">
          <SplitLines as="h2" text={messages.landingCtaTitle} />
          <p>{messages.landingCtaBody}</p>
          <FillBtn href="/contact">{messages.contactTitle}</FillBtn>
        </div>
      </section>

      <footer className="hx-footer">
        <div className="hx-footer-visual">
          <img src={HX.footer} alt="" />
        </div>
        <div className="hx-footer-copy">
          <p className="hx-kicker">{messages.brandName}</p>
          <div className="hx-footer-links">
            <Link href="/terms">{messages.termsTitle}</Link>
            <Link href="/privacy">{messages.privacyTitle}</Link>
            <Link href="/contact">{messages.contactTitle}</Link>
            <Link href="/pricing">{messages.pricingTitle}</Link>
            <Link href="/login">{messages.loginTitle}</Link>
            <Link href="/signup">{messages.landingCta}</Link>
          </div>
          <p className="hx-legal">{messages.pricingFree}</p>
        </div>
      </footer>
    </main>
  );
}
