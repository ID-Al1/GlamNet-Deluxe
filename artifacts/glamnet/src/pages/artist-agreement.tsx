import { LegalDocument, type LegalSection } from "@/components/legal-document";
import { LEGAL_IDENTITY as L, LEGAL_VERSIONS } from "@/lib/legal";

const SECTIONS: LegalSection[] = [
  {
    heading: "The parties",
    body: (
      <p>
        This agreement is between you, the artist, and {L.operator}, registration number{" "}
        {L.cipcRegistrationNumber}, of {L.registeredOffice} ("Bonisa"). It sits alongside our
        Terms of Service and Privacy Policy. If they conflict on a point about your work as an
        artist, this agreement applies.
      </p>
    ),
  },
  {
    heading: "Verification",
    body: (
      <>
        <p>
          You cannot be found, booked, or apply to casting calls until Bonisa has verified you.
          To be verified you must give us your true identity details, an identity document, and
          anything else we ask for. You confirm that everything you give us is yours and is true.
        </p>
        <p>
          We review each application and tell you the result. If we do not approve you, we give you
          the reason in writing and what to fix, and you may apply again. We may re-check your
          details at any time. Giving false information or a false document is a serious breach and
          may lead to immediate suspension.
        </p>
      </>
    ),
  },
  {
    heading: "You work for yourself",
    body: (
      <>
        <p>
          You are an independent contractor. You are not Bonisa's employee, partner or agent, and
          nothing here creates an employment relationship. Bonisa does not control how you do your
          work, which clients you accept, or your hours, and you may work elsewhere.
        </p>
        <p>
          You are responsible for your own tax (including VAT if you must register), insurance,
          equipment and products, and for any licence or qualification your work needs. Bonisa does
          not deduct tax from your payouts.
        </p>
      </>
    ),
  },
  {
    heading: "Your service obligations",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Keep your profile, portfolio, services and prices accurate. Only show work that is really yours.</li>
        <li>Accept only the bookings you can do. Turn up on time, prepared, and do the work you agreed to.</li>
        <li>Follow proper hygiene and safety practice, and use products safely and as they are meant to be used.</li>
        <li>Treat clients with respect and keep their personal information private.</li>
        <li>Respond to booking requests and messages promptly, and tell clients quickly if something changes.</li>
        <li>Confirm completed work in the app so your payment can be released.</li>
      </ul>
    ),
  },
  {
    heading: "Prices",
    body: (
      <p>
        You set your own prices. Bonisa may set a minimum rate for services on the platform, which
        we will show you in the app. The price a client pays is the price you set, with nothing
        added on top.
      </p>
    ),
  },
  {
    heading: "Commission and how you are paid",
    body: (
      <>
        <p>
          Bonisa keeps a platform fee of 18% of each booking. You receive 82%. The split is
          recorded on the booking when the client pays and does not change afterwards. Your
          dashboard always shows what you earn after the fee, not the client's price.
        </p>
        <p>
          Example: for a booking of R1,000, your share is R820 and Bonisa's fee is R180.
        </p>
        <p>
          For a team booking, each artist's agreed percentage of your 82% share is calculated
          separately. Amounts are rounded down to the cent, and the lead artist receives any
          remainder from rounding.
        </p>
        <p>
          The client's money is held until both you and the client confirm the work. Once it is
          released, Bonisa pays you within 24 hours to the bank account you gave us, after that
          account has been verified. If you change your bank details, the account must be verified
          again before you can be paid to it.
        </p>
      </>
    ),
  },
  {
    heading: "Cancellations and refund adjustments",
    body: (
      <>
        <p>
          A client may cancel a booking that is pending or confirmed, and you may decline a
          request. If you cancel or do not turn up for a booking that was paid for, the client is
          refunded and you earn nothing from it.
        </p>
        <p>
          If a booking is refunded in full, you are not paid for it. If it is refunded in part, your
          82% share and Bonisa's 18% fee are worked out on the amount that remains after the
          refund. Money that has already been released and paid to you is not clawed back through a
          complaint, but repeated refunds or valid complaints count against your standing.
        </p>
      </>
    ),
  },
  {
    heading: "Reputation score and tiers",
    body: (
      <>
        <p>
          Your profile shows a reputation score out of 100. It is worked out from your reviews, how
          rarely you cancel, how many clients come back to you, and how many bookings you have
          completed on Bonisa. The score places you in a tier: Rising, Established, Trusted or Elite.
          Higher tiers can unlock more, such as certain casting calls.
        </p>
        <p>
          The score is calculated by us using the same method for every artist. We may adjust the
          method to keep it fair and will keep it based on real activity. We do not sell or change
          scores for payment, and we remove reviews only as set out in our terms.
        </p>
      </>
    ),
  },
  {
    heading: "Complaints",
    body: (
      <p>
        If a client raises a complaint about you, we will tell you and you can respond and add
        evidence. Money still held for the booking is frozen while we decide. We will release it to
        you, refund the client in full, or split it, and we will tell you the outcome and why.
        Complaint evidence is private and seen only by the people who need it to decide.
      </p>
    ),
  },
  {
    heading: "Suspension",
    body: (
      <>
        <p>
          We may suspend your account if you break this agreement, give false information, put
          clients at risk, or we receive serious or repeated complaints. When you are suspended,
          your profile is hidden and you cannot take new bookings or apply to casting calls.
          Refunds owed to clients still go ahead.
        </p>
        <p>
          Money for work you properly completed before suspension is still paid to you, unless it is
          frozen for a complaint or we must hold it by law. We will tell you the reason and how to
          respond.
        </p>
      </>
    ),
  },
  {
    heading: "Ending the agreement",
    body: (
      <>
        <p>
          You may close your account at any time. Bookings already paid for must be completed or
          cancelled first. We may end this agreement with notice, or immediately for a serious
          breach.
        </p>
        <p>
          When it ends, you are still paid for completed work, and the sections on payment,
          complaints, privacy, client protection and liability continue to apply.
        </p>
      </>
    ),
  },
  {
    heading: "Keeping clients you meet here on Bonisa",
    body: (
      <>
        <p>
          Bonisa earns its fee by introducing you to clients. For 12 months after you first work
          for a client who found you through Bonisa, please continue to book and take payment for
          that client's appointments through Bonisa, so that the platform fee and protections apply.
        </p>
        <p>
          This is meant to be fair to you. It does not apply to clients you already had before
          joining, to people who come to you from your own channels, or to your work for anyone
          else. It does not stop you working anywhere you like. It only asks that a booking which
          began on Bonisa is completed on Bonisa.
        </p>
      </>
    ),
  },
  {
    heading: "Your content",
    body: (
      <p>
        You keep ownership of your photos and portfolio. You give Bonisa a licence to show them on
        the platform and in promotion of your profile while your account is active. You confirm you
        own the work you upload or have permission to use it.
      </p>
    ),
  },
  {
    heading: "Your information",
    body: (
      <p>
        We handle your identity documents and bank details with extra care, as explained in our
        Privacy Policy. Only authorised Bonisa staff can see them, and each time a full bank number
        is viewed it is logged.
      </p>
    ),
  },
  {
    heading: "Responsibility and law",
    body: (
      <>
        <p>
          You are responsible for the services you give and for any harm they cause. To the extent
          the law allows, Bonisa is not liable for your work or for indirect losses, and its
          liability to you is limited to the amounts due to you under this agreement.
        </p>
        <p>
          We may update this agreement and will tell you about material changes. South African law
          governs it. Questions: {L.businessEmail}
        </p>
      </>
    ),
  },
];

export default function ArtistAgreementPage() {
  return (
    <LegalDocument
      title="Artist Agreement"
      updated={LEGAL_VERSIONS.artistAgreement}
      intro="This agreement sets out how you work with Bonisa as a verified artist: what we do, what you do, how you are paid, and what happens if something goes wrong."
      sections={SECTIONS}
    />
  );
}
