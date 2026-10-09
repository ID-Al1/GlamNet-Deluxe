import { LegalDocument, type LegalSection } from "@/components/legal-document";
import { LEGAL_IDENTITY as L, LEGAL_VERSIONS } from "@/lib/legal";

const SECTIONS: LegalSection[] = [
  {
    heading: "Who is who",
    body: (
      <>
        <p>
          These terms are between you (the client or brand) and {L.operator}, registration number{" "}
          {L.cipcRegistrationNumber}, which operates Bonisa. They sit alongside our general Terms of
          Service and Privacy Policy.
        </p>
        <p>
          There are three parties in every booking: you, the artist, and Bonisa. The artist is an
          independent professional and gives you the service. Bonisa is the platform that verifies
          the artist, takes your payment, holds it safely and releases it. Bonisa does not provide
          the beauty service itself and is not the artist's employer.
        </p>
      </>
    ),
  },
  {
    heading: "Verified artists only",
    body: (
      <p>
        Only artists whose identity we have verified can be found or booked. Verification means we
        checked the identity details the artist gave us. It does not guarantee the quality of her
        work, so please read her profile, portfolio and reviews before you book.
      </p>
    ),
  },
  {
    heading: "How booking works",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>You choose an artist, a service, a date and a time, and send a booking request.</li>
        <li>The artist accepts or declines. A booking is confirmed only once she accepts.</li>
        <li>The price is shown in rand before you pay. Please check the service, time and place carefully.</li>
        <li>You pay through Bonisa. Please do not pay the artist directly for a booking made here.</li>
        <li>Give the artist accurate details, such as allergies, skin or hair concerns, and the address if she is coming to you.</li>
      </ul>
    ),
  },
  {
    heading: "How your payment is protected",
    body: (
      <>
        <p>
          When you pay, Bonisa holds the money. It is released to the artist only after both you
          and the artist confirm the work was done. Of the booking amount, 82% is for the artist
          and 18% is Bonisa's platform fee. You do not pay anything extra on top of the price you
          were shown.
        </p>
        <p>
          Please confirm the work promptly once it is done, and raise any problem before you
          confirm. If only one side confirms and the other does not respond in time, the booking is
          sent for review and the money is not paid out automatically.
        </p>
      </>
    ),
  },
  {
    heading: "Cancellations and refunds",
    body: (
      <>
        <p>
          You can cancel a booking in the app while it is pending or confirmed. An artist can also
          decline a request. Bonisa does not currently charge a cancellation fee. If an artist
          cancels or declines a booking you have paid for, you are entitled to a refund of what you
          paid. Any cancellation conditions that apply to a particular booking will be shown to you
          before you pay.
        </p>
        <p>
          If a complaint leads to a full or partial refund, the refund goes back to the way you paid.
          Money that has already been released to the artist cannot be refunded through a complaint,
          which is why you should raise problems before you confirm the work. Nothing here limits
          your rights under the Consumer Protection Act.
        </p>
      </>
    ),
  },
  {
    heading: "How to behave",
    body: (
      <ul className="list-disc pl-5 space-y-2">
        <li>Treat artists with respect. Harassment, discrimination and abuse lead to suspension.</li>
        <li>Be on time and be available at the place and time you booked.</li>
        <li>Do not ask an artist to do anything unsafe, unlawful, or outside the service you booked.</li>
        <li>Do not try to pay an artist outside Bonisa to avoid the platform fee for a booking that began here.</li>
        <li>Keep your login private, and do not create accounts to get around a suspension.</li>
      </ul>
    ),
  },
  {
    heading: "Reviews",
    body: (
      <p>
        After a completed booking you can leave a review. Reviews must be honest and based on your
        own experience. We may remove reviews that are false, abusive, unrelated to the service, or
        written in exchange for a payment or a favour. Artists cannot buy or remove honest reviews.
      </p>
    ),
  },
  {
    heading: "Complaints",
    body: (
      <>
        <p>
          If something goes wrong, raise a complaint in the app and add any photos or messages that
          help. While a complaint is open, any money still held for that booking stays frozen. We
          look at what both sides send, may ask questions, and then decide to release the money,
          refund it in full, or refund part of it. You will be told the outcome.
        </p>
        <p>
          The evidence you send is kept private and is seen only by the people who need it to decide
          the complaint.
        </p>
      </>
    ),
  },
  {
    heading: "Brands and casting calls",
    body: (
      <p>
        If you are a brand, you may post casting calls and see applicants with their verification,
        tier and jobs completed. Budgets must be real. Every applicant is told the outcome of her
        application, so please close each call out properly instead of leaving applicants waiting.
      </p>
    ),
  },
  {
    heading: "Limits of responsibility",
    body: (
      <>
        <p>
          The artist is responsible for the service she provides, including its quality, her
          products and her safety practices. Bonisa is responsible for running the platform with
          reasonable care, for verifying identities as described, and for handling your payment and
          complaints as set out here.
        </p>
        <p>
          You are responsible for the accuracy of what you tell the artist and for your own conduct.
          To the extent the law allows, Bonisa is not liable for the artist's work or for indirect
          losses, and our liability for any booking is limited to the amount you paid for it. This
          does not limit any right you have by law that cannot be waived.
        </p>
      </>
    ),
  },
  {
    heading: "Suspension, changes and law",
    body: (
      <>
        <p>
          We may suspend an account that breaks these terms. Refunds that are owed still go ahead.
          We may update these terms and will tell you about material changes. South African law
          governs these terms.
        </p>
        <p>Questions: {L.businessEmail}</p>
      </>
    ),
  },
];

export default function ClientTermsPage() {
  return (
    <LegalDocument
      title="Client Terms of Use"
      updated={LEGAL_VERSIONS.clientTerms}
      intro="These terms explain how booking works for clients and brands, and what each of us is responsible for."
      sections={SECTIONS}
    />
  );
}
