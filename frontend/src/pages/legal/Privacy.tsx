import LegalPage, { Bullets, CONTACT_EMAIL, OPERATOR, Section } from '../../components/legal/LegalPage';

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="17 October 2026"
      intro={
        <p>
          This policy explains what personal data ResearchPadi collects, why, who we share it with and the choices you
          have. ResearchPadi is run by {OPERATOR}, which is responsible for your data under Ghana's Data Protection
          Act, 2012 (Act 843).
        </p>
      }
    >
      <Section title="1. What we collect">
        <Bullets items={[
          <><strong>Account details:</strong> your phone number, full name, institution type and name, programme and level.</>,
          <><strong>Your work:</strong> what you give us and what we create for you, such as paper briefs (topic, course, supervisor's name, research questions), study drafts, Workspace documents, text taken from sources you upload, questions you ask the AI, and human review requests and feedback. We keep the text of uploaded sources, not the original files.</>,
          <><strong>Payments:</strong> amounts, references and the status of your top-ups and purchases. The email address you enter for a top-up goes to Paystack for your receipt; we don't keep it. Paystack handles your card or mobile money details, and we never see them.</>,
          <><strong>Sign-in codes:</strong> stored in scrambled form for five minutes, then deleted.</>,
          <><strong>Technical and security data:</strong> your IP address, basic device and browser details, records of sign-ins and important account actions, and records of how much AI you use and what it costs (not the text itself).</>,
          <><strong>On your device:</strong> we keep your sign-in session and some editor preferences in your browser's local storage. We don't use advertising or tracking cookies.</>,
        ]} />
      </Section>

      <Section title="2. How we use it">
        <Bullets items={[
          'To run ResearchPadi and produce what you ask for.',
          'To take payments and keep accurate accounts.',
          'To send your sign-in codes by SMS.',
          'To keep the service safe, for example by limiting repeated attempts and spotting abuse.',
          'To help you when you contact us, and to fix and improve the service.',
          'To meet our legal obligations.',
        ]} />
        <p>We don't sell your personal data, and we don't use it for advertising.</p>
      </Section>

      <Section title="3. Who we share it with">
        <p>We share data only with service providers who help us run ResearchPadi, and only what each one needs:</p>
        <Bullets items={[
          <><strong>Supabase</strong> stores our database.</>,
          <><strong>Render</strong> runs our servers, and <strong>Vercel</strong> hosts our website.</>,
          <><strong>Anthropic, OpenAI and Perplexity</strong> process the text needed to produce AI writing, answers and research.</>,
          <><strong>Paystack</strong> processes payments.</>,
          <><strong>Arkesel</strong> sends sign-in codes by SMS.</>,
          <>A caching provider briefly holds short-lived data such as sign-in codes and usage limits.</>,
        ]} />
        <p>
          If you book a human review, your reviewer sees the text you send and your institution type and programme,
          not your name or phone number. We may also share data when the law requires it.
        </p>
      </Section>

      <Section title="4. Data stored outside Ghana">
        <p>
          Our service providers store and process data outside Ghana, including in the United States. We choose
          established providers and send them only what they need to do their job.
        </p>
      </Section>

      <Section title="5. How long we keep it">
        <Bullets items={[
          'Your account details and work, for as long as your account is open. You can delete study drafts and Workspace documents yourself at any time.',
          'When you ask us to close your account, we delete your personal data within 30 days, except records we must keep by law, such as payment records for accounting and tax.',
          'Security and technical logs, for a limited time and only as long as they are useful for keeping the service safe.',
        ]} />
      </Section>

      <Section title="6. Keeping it safe">
        <p>
          Data travels over encrypted connections (HTTPS). Sign-in codes are stored scrambled. Access to our systems is
          limited to people who need it. No system is perfectly secure, so if we learn of a breach that affects you,
          we will tell you and the Data Protection Commission as the law requires.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>Under the Data Protection Act, 2012 (Act 843), you can ask us to:</p>
        <Bullets items={[
          'show you the personal data we hold about you;',
          'correct data that is wrong;',
          'delete your data;',
          'stop using your data for a particular purpose.',
        ]} />
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand font-semibold hover:underline">{CONTACT_EMAIL}</a> from
          the phone number on your account, or tell us that number, so we can confirm it's you. If you're not happy with
          our answer, you can complain to the Data Protection Commission of Ghana (dataprotection.org.gh).
        </p>
      </Section>

      <Section title="8. Young users">
        <p>ResearchPadi is meant for tertiary students. If you are under 18, please use it with a parent or guardian's permission.</p>
      </Section>

      <Section title="9. Changes and contact">
        <p>
          We may update this policy and will change the date at the top when we do. Questions? Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand font-semibold hover:underline">{CONTACT_EMAIL}</a>.
        </p>
      </Section>
    </LegalPage>
  );
}
