import LegalPage, { Bullets, CONTACT_EMAIL, Section } from '../../components/legal/LegalPage';
import { FULL_PAPER } from '../../data/plans';

export default function Refunds() {
  return (
    <LegalPage
      title="Refund Policy"
      updated="17 October 2026"
      intro={
        <p>
          You pay for ResearchPadi services from your wallet, which you top up through Paystack. This page explains
          when you get money back, and how.
        </p>
      }
    >
      <Section title="Study drafts">
        <Bullets items={[
          `If we can't produce your study draft, the full GHS ${FULL_PAPER.price} goes back to your wallet automatically.`,
          'If a delivered draft is badly incomplete (for example a whole chapter is missing or it stops partway), tell us within 7 days. We will produce it again or refund it to your wallet.',
          'We don\'t refund a delivered draft because you don\'t like its style. Each draft includes one extra AI supervisor review you can run yourself.',
        ]} />
      </Section>

      <Section title="Workspace plans">
        <Bullets items={[
          'A plan starts as soon as you buy it and lasts 30 days.',
          'Plans aren\'t refundable once started, unless a fault on our side stopped you using the service. In that case we will extend your plan or refund the unused part to your wallet.',
        ]} />
      </Section>

      <Section title="Human reviews">
        <Bullets items={[
          'Cancel before a reviewer picks up your request and you get a full refund to your wallet automatically.',
          'If we cancel your review, or it isn\'t returned within the promised time, contact us and we will refund it to your wallet.',
        ]} />
      </Section>

      <Section title="Unused wallet credit">
        <Bullets items={[
          'If you haven\'t spent a top-up, ask within 14 days of making it and we will refund that unspent amount to the card or mobile money account you paid with.',
          'After 14 days, credit stays in your wallet for you to use on ResearchPadi.',
        ]} />
      </Section>

      <Section title="Payment problems">
        <p>
          If Paystack charged you but your wallet didn't go up, or you were charged twice, email us with your Paystack
          reference. We will credit your wallet or refund the payment.
        </p>
      </Section>

      <Section title="How to ask for a refund">
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand font-semibold hover:underline">{CONTACT_EMAIL}</a> with
          the phone number on your account, the transaction reference (shown in your wallet history) and what went wrong.
          We aim to reply within 2 working days. Refunds to a card or mobile money account can take several working
          days to arrive, depending on your bank or provider.
        </p>
      </Section>
    </LegalPage>
  );
}
