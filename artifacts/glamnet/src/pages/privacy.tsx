import { LegalDocument, type LegalSection } from "@/components/legal-document";
import { LEGAL_IDENTITY as L, LEGAL_VERSIONS } from "@/lib/legal";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who is responsible for your information",
    body: (
      <>
        <p>
          {L.operator} (registration number {L.cipcRegistrationNumber}), of {L.registeredOffice},
          operates Bonisa and is the responsible party under the Protection of Personal Information
          Act (POPIA).
        </p>
        <p>Privacy contact and Information Officer: {L.privacyEmail}</p>
      </>
    ),
  },
  {
    heading: "What we collect",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>
          <strong>Account details:</strong> your name, email address, phone number, password (stored
          in protected form) and the type of account you hold.
        </li>
        <li>
          <strong>Profile content:</strong> photos, portfolio items, services, prices, location or
          area, reviews and messages you choose to add.
        </li>
        <li>
          <strong>Artist verification details:</strong> your identity number and identity
          documents, and any other documents we ask for to verify you.
        </li>
        <li>
          <strong>Payment and payout details:</strong> booking and payment records, and for artists,
          the bank account details needed to pay you. Card details are handled by our payment
          processor and are not stored by Bonisa.
        </li>
        <li>
          <strong>Complaint evidence:</strong> anything you send us when you raise or respond to a
          complaint.
        </li>
        <li>
          <strong>Technical details:</strong> basic information about your device and how you use
          the app, used to keep it secure and working.
        </li>
      </ul>
    ),
  },
  {
    heading: "Why we use it",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>To create your account and run the service you asked for.</li>
        <li>To verify artists and keep unverified or fake accounts off the platform.</li>
        <li>To take payments, hold funds, and pay artists correctly.</li>
        <li>To handle complaints, refunds and disputes fairly.</li>
        <li>To keep Bonisa safe, prevent fraud and meet our legal duties.</li>
        <li>To send you messages about your bookings, payments and account, by WhatsApp or email.</li>
        <li>To send you news and offers, only if you chose to receive them (see Marketing below).</li>
      </ul>
    ),
  },
  {
    heading: "What other people can see",
    body: (
      <p>
        An artist's public profile shows the name, photos, specialty, area, services and track
        record she has chosen to display. Identity numbers and identity documents are never
        displayed publicly. They are kept in a private store and can be viewed only by authorised
        Bonisa staff when reviewing a verification. Bank account numbers are masked in normal use,
        and a full number is revealed only to authorised staff for a specific payout task, and each
        reveal is logged.
      </p>
    ),
  },
  {
    heading: "Who we share it with",
    body: (
      <>
        <p>We do not sell your personal information. We share it only where needed:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>With the other party to a booking, as needed to deliver it.</li>
          <li>With service providers who work for us, such as our payment processor, and the providers that host our systems, store files, and send our WhatsApp messages and emails. They may use your information only for the service they give us.</li>
          <li>With banks, to pay artists.</li>
          <li>With authorities, courts or regulators where the law requires it.</li>
        </ul>
        <p>
          Some providers may store information outside South Africa. Where that happens, we take
          steps to make sure it is protected to a standard that POPIA accepts.
        </p>
      </>
    ),
  },
  {
    heading: "How long we keep it",
    body: (
      <p>
        We keep your information for as long as you hold an account and as long as we need it for
        the reasons above. Some records, such as payment records, complaint outcomes and logs of
        access to sensitive data, are kept for longer because the law or our need to resolve
        disputes requires it.
      </p>
    ),
  },
  {
    heading: "How we protect it",
    body: (
      <p>
        We use access controls, private storage for sensitive documents, and audit logs for access
        to sensitive information. No system is perfectly secure. If a breach affects your personal
        information, we will tell you and the Information Regulator as POPIA requires.
      </p>
    ),
  },
  {
    heading: "Marketing",
    body: (
      <p>
        We send marketing only if you tick the box for it when you sign up. It is off unless you
        choose it, and joining Bonisa does not depend on it. You can change your mind at any time by
        emailing {L.privacyEmail}, and we will stop. Messages about your bookings, payments and
        account are not marketing and will still be sent.
      </p>
    ),
  },
  {
    heading: "Your rights",
    body: (
      <>
        <p>Under POPIA you can ask us to:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>tell you what information we hold about you,</li>
          <li>correct information that is wrong or out of date,</li>
          <li>delete information we no longer need or have no right to keep,</li>
          <li>stop using your information for a purpose you object to.</li>
        </ul>
        <p>
          Send your request to {L.privacyEmail}. We may need to confirm your identity first. If you
          are not happy with how we handle your information, you can complain to the Information
          Regulator of South Africa at complaints.IR@inforegulator.org.za.
        </p>
      </>
    ),
  },
  {
    heading: "Cookies and similar technology",
    body: (
      <p>
        We use only the storage needed to keep you signed in and remember simple preferences, such
        as light or dark mode.
      </p>
    ),
  },
  {
    heading: "Children",
    body: (
      <p>
        Bonisa is for people aged 18 and over. We do not knowingly collect information from
        children.
      </p>
    ),
  },
  {
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy. When we make a material change we will tell you in the app or
        by email. The date at the top shows when it was last changed.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated={LEGAL_VERSIONS.privacy}
      intro="This policy explains what personal information Bonisa collects, why, who sees it, and the choices you have. It is written to meet South Africa's Protection of Personal Information Act (POPIA)."
      sections={SECTIONS}
    />
  );
}
