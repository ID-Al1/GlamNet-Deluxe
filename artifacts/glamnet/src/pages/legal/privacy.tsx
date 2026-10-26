import { Link } from "wouter";
import { INFORMATION_OFFICER_EMAIL, PRIVACY_POLICY_VERSION } from "@/lib/legal";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Who we are",
    body: [
      "Bonisa is operated by Opus Intelligence (Pty) Ltd, South Africa. We are the responsible party under the Protection of Personal Information Act (POPIA) for the personal information described below.",
    ],
  },
  {
    title: "What we collect",
    body: [
      "Account details: your name, email address, phone number, role (client, artist or brand) and a securely stored password.",
      "Artist profile details: your specialty, location, services, prices, portfolio photos and availability.",
      "Verification details (artists): identity documents you upload so we can verify you. These are stored privately and only our review team can see them.",
      "Safety contact (artists): if you choose, the name and phone number of someone you trust. We store it for you and never contact them. Your phone uses it when you tap the safety buttons.",
      "Payout details (artists): bank account details so we can pay you. These are masked in the app and only revealed to authorised staff when needed to make a payment.",
      "Booking, payment and chat details: your appointments, payment records (card payments are handled by Stripe, we do not store your card number), messages, reviews and any complaints you submit.",
    ],
  },
  {
    title: "Why we use it",
    body: [
      "To run your account, verify artists, take and pay for bookings, pay artists, handle complaints and keep Bonisa safe from fraud and fake accounts.",
      "To send you notices about your bookings, messages and payments.",
      "To meet our legal and tax obligations.",
    ],
  },
  {
    title: "Who we share it with",
    body: [
      "Artists and clients see what they need to complete a booking together. Your phone number and identity documents are not shown on public pages.",
      "For a paid booking, the artist can see her client's name and phone number from 24 hours before the appointment until 12 hours after it, so she can tell someone she trusts who she is meeting.",
      "Service providers who help us run Bonisa, such as Stripe for payments, and our hosting and messaging providers. They may only use your information to provide their service to us.",
      "Authorities, where the law requires it.",
      "We do not sell your personal information.",
    ],
  },
  {
    title: "How long we keep it",
    body: [
      "We keep your information while your account is active. Records we are required to keep by law, such as payment and tax records, are kept for the period the law requires. When you ask us to delete your account, we remove the personal information we are not required to keep.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You can ask to see the personal information we hold about you, ask us to correct it, ask us to delete it, or object to how we use it.",
      "If you are unhappy with how we handle your information, you can complain to the Information Regulator of South Africa at inforegulator.org.za.",
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold">Privacy policy</h1>
        <p className="text-sm text-muted-foreground">Version {PRIVACY_POLICY_VERSION}</p>
      </div>

      {SECTIONS.map(section => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.body.map(paragraph => (
            <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">{paragraph}</p>
          ))}
        </section>
      ))}

      {INFORMATION_OFFICER_EMAIL && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact our Information Officer</h2>
          <p className="text-sm text-muted-foreground">
            <a href={`mailto:${INFORMATION_OFFICER_EMAIL}`} className="text-primary hover:underline">{INFORMATION_OFFICER_EMAIL}</a>
          </p>
        </section>
      )}

      <Link href="/signup" className="text-sm text-primary hover:underline">Back to sign up</Link>
    </div>
  );
}
