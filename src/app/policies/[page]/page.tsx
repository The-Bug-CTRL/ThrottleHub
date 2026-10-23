import { notFound } from "next/navigation";
import { brand } from "@/lib/config";
const policies: Record<string, { title: string; paragraphs: string[] }> = {
  history: {
    title: "Listing history and removal",
    paragraphs: [
      "Sold, expired and on-hold adverts are kept at their original links as a historical catalogue of advertised motorcycles, parts and equipment. They do not appear in active inventory and cannot receive new buyer enquiries. Asking prices are advertisements, not verified sale prices.",
      "Mark sold only when this particular item has sold. Pause an advert using On hold. Reactivate an expired or on-hold advert only for the same item; create a new advert for a different item. Sold adverts cannot be edited or relisted.",
      "Historical adverts retain their item description, specifications, general location, advertised prices, dates and photos until removed or restricted. Keep personal details, identity documents, residential addresses and buyer information out of public advert text and photos. Public seller profiles may remain linked while the account exists.",
      "In Your garage, Remove advert removes the public content and deletes its listing photos. It is separate from Mark sold and cannot be undone. A minimal non-personal ID tombstone prevents reuse of the old link. Private conversations remain accessible only to their participants and follow their own retention policy.",
      "For fraud, copyright or privacy concerns, use Report on the advert. Moderators can restrict access while investigating. An administrator can remove an advert or de-identify a historical record, removing its seller link, free text and photographs while keeping basic motorcycle information. Account deletion requires an administrator to review all the account's adverts before deleting the account.",
      "Media deletion is retried if storage is temporarily unavailable. Pending cleanup contains an account identifier only until deletion succeeds. Operators must monitor and resolve pending jobs. Copies already downloaded by other people, search engines or browser caches cannot be recalled; the operator must handle external cache removal requests separately.",
      "The operator must approve a lawful retention basis, review schedule, support contact and separate messaging/account retention periods before public launch. This development policy does not authorise indefinite retention of personal information. Historical discovery is supported, but search engine indexing is not guaranteed.",
    ],
  },
  rules: {
    title: "The riding code",
    paragraphs: [
      "List only items you own or have permission to sell. Stolen goods, fraud, misleading descriptions and prohibited items have no place here.",
      "Describe condition and fitment honestly. Compatibility is a seller claim unless an actual verification process says otherwise.",
      "Inspect items before payment. Agree collection, shipping, duties and payment directly. Report suspicious listings. Never send money merely to view an item.",
      "Respect other riders. Harassment, spam and impersonation may lead to removal or suspension.",
    ],
  },
  privacy: {
    title: "Privacy notice — review draft",
    paragraphs: [
      `${brand.name} uses Firebase Authentication, Firestore and Storage for account and marketplace data. Public profiles and published adverts are public; account email addresses and participant messages are private.`,
      "Only provide information needed to trade. Do not publish residential addresses, identity documents or sensitive payment information.",
      "Your public profile may show your profile photo, bio, general location, active adverts and published reviews. Followers and following lists are public. Unfollowing removes that relationship; account-removal requests must also remove the account's reciprocal follow records.",
      "Before launch, the operator must identify its legal entity, Information Officer, contact details, lawful processing purposes, retention periods, cross-border safeguards, processors and POPIA request procedures.",
      "Data access, export and deletion workflows are not yet available. A functioning support process and legal review are required before collecting real customer data.",
    ],
  },
  terms: {
    title: "Marketplace terms — review draft",
    paragraphs: [
      "These draft marketplace terms require legal review before public launch.",
      "The platform introduces buyers and sellers. It does not provide checkout, escrow, seller verification or an item authentication guarantee.",
      "Buyers and sellers remain responsible for checking ownership, condition, safety, compatibility, payment arrangements, shipping and applicable import requirements.",
      "Before launch, legal counsel must confirm operator details, consumer rights, dispute procedures, liability terms, age requirements, governing law and acceptance records.",
    ],
  },
};
export function generateStaticParams() {
  return Object.keys(policies).map((page) => ({ page }));
}
export default async function Policy({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const p = policies[(await params).page];
  if (!p) notFound();
  return (
    <article className="policy">
      <div className="eyebrow">OUR COMMUNITY</div>
      <h1>{p.title}</h1>
      <p className="notice">
        Development policy · Requires legal and operational review before public
        launch.
      </p>
      {p.paragraphs.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </article>
  );
}
