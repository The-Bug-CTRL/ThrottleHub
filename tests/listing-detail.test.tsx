import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { listing } from "./fixtures";
vi.mock("../src/components/session", () => ({
  useSession: () => ({ user: null }),
}));
vi.mock("../src/lib/firebase", () => ({ db: {} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../src/components/member-reviews", () => ({
  RatingBadge: () => null,
}));
vi.mock("../src/components/card", () => ({
  Favourite: () => null,
  Card: () => null,
}));
vi.mock("../src/components/gallery", () => ({
  Gallery: () => <div>Historical photos</div>,
}));
vi.mock("../src/components/category-navigation", () => ({
  CategoryBreadcrumbs: () => null,
}));
import { ListingDetail } from "../src/components/detail";
it("server-renders historical details, asking-price labels and disabled enquiry controls", () => {
  for (const status of ["sold", "expired", "on-hold"] as const) {
    const html = renderToStaticMarkup(
      <ListingDetail
        listing={{
          ...listing(),
          status,
          soldAt: status === "sold" ? 1000 : undefined,
        }}
        similar={[]}
      />,
    );
    expect(html).toContain("historical reference");
    expect(html).toContain("not a verified completed transaction price");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>/);
    expect(html).toContain("Permission test motorcycle");
    expect(html).toContain("Historical photos");
  }
});
it("anonymises seller presentation without losing the item record", () => {
  const html = renderToStaticMarkup(
    <ListingDetail
      listing={{
        ...listing(),
        status: "sold",
        ownerId: "",
        sellerAnonymised: true,
      }}
      similar={[]}
    />,
  );
  expect(html).toContain("Seller account removed");
  expect(html).not.toContain("View seller profile");
});
