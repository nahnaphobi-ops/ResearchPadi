import { Link } from 'react-router-dom';
import LegalPage, { Bullets, CONTACT_EMAIL, OPERATOR, Section } from '../../components/legal/LegalPage';
import { FULL_PAPER, WORKSPACE_PLANS } from '../../data/plans';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="17 October 2026"
      intro={
        <p>
          These terms explain how you may use ResearchPadi, which is run by {OPERATOR} ("we", "us"). By creating an
          account, topping up your wallet or buying anything on ResearchPadi, you agree to them. Please read section 4
          on study drafts carefully.
        </p>
      }
    >
      <Section title="1. Your account">
        <Bullets items={[
          'You sign in with your phone number and a one-time code we send by SMS. Keep your codes private. Anyone with your code can get into your account.',
          'Use one account per person, and keep your profile details accurate.',
          'You are responsible for what happens on your account. Tell us straight away if you think someone else has used it.',
          'ResearchPadi is meant for tertiary students. If you are under 18, you need a parent or guardian\'s permission to use it.',
        ]} />
      </Section>

      <Section title="2. What we offer">
        <Bullets items={[
          <><strong>Study Draft</strong> (GHS {FULL_PAPER.price} each): a full research draft written by AI from your brief, for you to study from.</>,
          <><strong>Workspace</strong> (Standard GHS {WORKSPACE_PLANS.standard.price}, Premium GHS {WORKSPACE_PLANS.premium.price}, each for 30 days): an editor where you write your own work with AI help, citation search and checks.</>,
          <><strong>Human supervisor review</strong> (Premium): an approved human reviewer reads your writing and gives feedback.</>,
        ]} />
        <p>We may improve or change features over time. If you have paid for a period, you keep what you paid for until that period ends.</p>
      </Section>

      <Section title="3. AI can be wrong">
        <p>
          Our AI can make mistakes. It can state things that aren't true, misread sources, or produce references that
          are wrong or don't exist. We check study-draft references against academic databases and flag any we can't
          match, but we can't guarantee that everything is accurate. Check facts and sources yourself before you rely
          on them.
        </p>
      </Section>

      <Section title="4. Study drafts and academic honesty">
        <p>A study draft is written by AI. It is a study, reference and planning aid. It is not your own work.</p>
        <Bullets items={[
          'You must not submit a study draft, or any part of it, as your own work. That includes coursework, projects, theses, dissertations, exams, publications and anything else where your own work is expected.',
          'Every downloaded study draft is marked as AI-generated. You must not remove or hide these marks to pass the draft off as your own.',
          'You must not sell or give study drafts to other people to submit.',
          'Follow your institution\'s rules on using AI. If you use AI help in the Workspace, say so wherever your institution requires it.',
          'You are responsible for what you hand in, and for any consequence of breaking your institution\'s rules.',
        ]} />
        <p>We may suspend or close an account that breaks this section.</p>
      </Section>

      <Section title="5. Payments and your wallet">
        <Bullets items={[
          'Prices are in Ghana cedis (GHS) and are shown before you pay.',
          'You top up your ResearchPadi wallet through Paystack, using the payment methods Paystack offers. We never see your card or mobile money PIN.',
          'Wallet credit can only be spent on ResearchPadi. It is not a bank account, earns no interest and can\'t be moved to another person.',
          'Workspace plans last 30 days from purchase and do not renew automatically. If you buy a plan while one is active, you switch to the new plan straight away and 30 days are added to your current end date.',
          'Each plan includes a daily allowance of AI use, which resets at midnight (GMT).',
        ]} />
        <p>Refunds are covered by our <Link to="/refunds" className="text-brand font-semibold hover:underline">Refund Policy</Link>.</p>
      </Section>

      <Section title="6. Human reviews">
        <p>
          Reviews are done by independent reviewers we approve. They give feedback and suggestions. They do not write
          your work for you. We aim to return reviews within the time shown when you book.
        </p>
      </Section>

      <Section title="7. Your content">
        <Bullets items={[
          'You keep the rights to what you write and upload.',
          'You allow us to store and process your content to run the service. That includes sending it to our AI providers to produce what you asked for and, if you book a review, showing it to your reviewer.',
          'Only upload material you have the right to use.',
          <>How we handle personal data is explained in our <Link to="/privacy" className="text-brand font-semibold hover:underline">Privacy Policy</Link>.</>,
        ]} />
      </Section>

      <Section title="8. Things you must not do">
        <Bullets items={[
          'Break the law, or upload anything unlawful, hateful or harmful.',
          'Try to get around our security, usage limits or payment checks.',
          'Use bots or scripts to access ResearchPadi, or copy large parts of it.',
          'Share, sell or rent your account.',
        ]} />
      </Section>

      <Section title="9. Availability">
        <p>We work hard to keep ResearchPadi running, but we can't promise it will always be available or free of errors. We may pause it for maintenance.</p>
      </Section>

      <Section title="10. Our responsibility to you">
        <p>
          ResearchPadi is provided "as is". As far as the law allows, we are not responsible for indirect losses, or
          for academic penalties that result from how you use our service, including breaking section 4. Our total
          responsibility to you for any claim is limited to what you paid us in the three months before the claim.
          Nothing in these terms takes away rights you have under Ghanaian law that cannot be removed.
        </p>
      </Section>

      <Section title="11. Closing your account">
        <p>
          You can stop using ResearchPadi at any time and ask us to delete your account by emailing {CONTACT_EMAIL}.
          We may suspend or close accounts that break these terms. What happens to unused wallet credit is covered in
          the Refund Policy.
        </p>
      </Section>

      <Section title="12. Changes to these terms">
        <p>We may update these terms. We will change the date at the top, and tell you in the app or by SMS about important changes before they apply to you.</p>
      </Section>

      <Section title="13. Law">
        <p>These terms are governed by the laws of the Republic of Ghana, and the courts of Ghana deal with any dispute.</p>
      </Section>

      <Section title="14. Contact">
        <p>Questions? Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand font-semibold hover:underline">{CONTACT_EMAIL}</a>.</p>
      </Section>
    </LegalPage>
  );
}
