import { LegalDocument, type LegalSection } from "@/components/legal-document";
import { LEGAL_IDENTITY as L, LEGAL_VERSIONS } from "@/lib/legal";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who we are",
    body: (
      <p>
        Bonisa is a verified professional network for South Africa's beauty industry, operated by{" "}
        {L.operator}, registration number {L.cipcRegistrationNumber}, of {L.registeredOffice}. In
        these terms, "Bonisa", "we" and "us" mean that company. You can reach us at{" "}
        {L.businessEmail}.
      </p>
    ),
  },
  {
    heading: "Accepting these terms",
    body: (
      <p>
        By creating an account or using Bonisa, you agree to these terms and to our Privacy Policy.
        You must be at least 18 years old and able to enter into a binding agreement. If you do not
        agree, please do not use Bonisa.
      </p>
    ),
  },
  {
    heading: "What Bonisa does",
    body: (
      <p>
        Bonisa lets clients and brands find, book and pay verified beauty artists. We are a
        platform. The service itself, such as hair, makeup or any other beauty work, is provided by
        the artist, who is an independent professional and not our employee or agent. Bonisa lists
        individuals, not salons.
      </p>
    ),
  },
  {
    heading: "Accounts",
    body: (
      <>
        <p>
          You must give accurate information and keep your login details safe. You are responsible
          for activity on your account. Tell us at once if you think someone else has used it.
        </p>
        <p>
          There are three kinds of account: client, artist and brand. Each has its own dashboard
          and its own rules.
        </p>
      </>
    ),
  },
  {
    heading: "Artist verification",
    body: (
      <>
        <p>
          Artists must be verified before they appear in search, can be booked, or can apply to
          casting calls. To be verified, an artist must give us true identity details and the
          documents we ask for. We review each application and, if we reject it, we give the
          reason in writing.
        </p>
        <p>
          Verification means we have checked the identity details submitted. It is not a guarantee
          of the quality of an artist's work. Giving false information or a false document may lead
          to immediate suspension and, where the law requires, a report to the authorities.
        </p>
      </>
    ),
  },
  {
    heading: "Bookings and payment",
    body: (
      <>
        <p>
          Prices are set by the artist and shown in rand before you pay. Payment is made through
          Bonisa and processed securely by a third-party payment processor. We do not store your
          full card details.
        </p>
        <p>
          When you pay, the money is held by Bonisa until the work is done. Of each booking amount,
          82% is for the artist and 18% is Bonisa's platform fee. That split is recorded on your
          booking when you pay and does not change afterwards.
        </p>
        <p>
          Funds are released to the artist once both the client and the artist confirm that the
          work was done. If only one side confirms and the other does not respond within the time
          we allow, the booking is escalated for review instead of being paid out automatically.
          Payouts to artists are made to the bank details the artist has given us and that we have
          verified.
        </p>
      </>
    ),
  },
  {
    heading: "Complaints and disputes",
    body: (
      <>
        <p>
          If something goes wrong with a booking, either side can raise a complaint through the
          app. While a complaint is open, any money still held for that booking stays frozen. We
          review the evidence both sides give, may ask for more, and then decide whether to release
          the money, refund it in full, or refund part of it.
        </p>
        <p>
          Money that has already been released to an artist cannot be turned into a dispute
          afterwards, so please raise problems before you confirm that the work is complete. Nothing
          in this section limits any right you have under the Consumer Protection Act.
        </p>
      </>
    ),
  },
  {
    heading: "Keeping bookings on Bonisa",
    body: (
      <p>
        Verified identity, completed jobs and reviews are what make Bonisa useful. Escrow
        protection, dispute handling and an artist's record only apply to bookings made and paid
        through Bonisa. We ask that you do not use Bonisa to meet someone and then take the
        booking elsewhere to avoid the platform fee.
      </p>
    ),
  },
  {
    heading: "Content and conduct",
    body: (
      <>
        <p>
          You keep ownership of the photos, portfolio items, reviews and messages you upload. You
          give us a licence to store and display them on Bonisa for the purpose of running the
          service. Only upload content you have the right to use.
        </p>
        <p>
          You may not harass others, post false or misleading reviews, share unlawful or abusive
          content, try to get around our security or verification, or use Bonisa for anything
          illegal.
        </p>
      </>
    ),
  },
  {
    heading: "Suspension and ending your account",
    body: (
      <p>
        We may suspend or close an account that breaks these terms or puts others at risk. A
        suspended account loses access and an artist's profile is hidden, but refunds owed to
        clients still go ahead. You can ask us to close your account at any time. Bookings already
        paid for will be completed or settled first.
      </p>
    ),
  },
  {
    heading: "Our responsibility",
    body: (
      <p>
        We work to keep Bonisa available and accurate, but we do not promise it will never be
        interrupted. As the platform, we are not responsible for the quality of an artist's work,
        or for what happens between people outside our control. To the extent the law allows, our
        liability to you is limited to the amounts you paid through Bonisa for the booking in
        question. Nothing in these terms removes rights you have by law that cannot be waived.
      </p>
    ),
  },
  {
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these terms. When we make a material change we will tell you in the app or
        by email. If you keep using Bonisa after a change takes effect, you accept the new terms.
      </p>
    ),
  },
  {
    heading: "Governing law and contact",
    body: (
      <p>
        These terms are governed by the laws of South Africa, and the South African courts have
        jurisdiction. Questions about these terms can be sent to {L.businessEmail}.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated={LEGAL_VERSIONS.terms}
      intro="These terms explain how Bonisa works and what we expect from each other. We have tried to keep them in plain language."
      sections={SECTIONS}
    />
  );
}
