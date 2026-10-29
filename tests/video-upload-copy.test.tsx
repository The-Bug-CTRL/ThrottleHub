import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { User } from "firebase/auth";
vi.mock("../src/lib/firebase", () => ({ storage: {} }));
import { RunningVideoUpload } from "../src/components/running-video-upload";
it("explains the motorcycle requirement and clearly labels retained non-motorcycle footage optional", () => {
  const props = {
    user: { uid: "owner" } as User,
    listingId: "listing",
    value: null,
    onChange: vi.fn(),
    onBusy: vi.fn(),
  };
  const motorcycle = renderToStaticMarkup(<RunningVideoUpload {...props} />);
  expect(motorcycle).toContain("Running video required");
  expect(motorcycle).toContain("with sound");
  const part = renderToStaticMarkup(
    <RunningVideoUpload {...props} required={false} />,
  );
  expect(part).not.toContain("Running video required");
  expect(part).toContain("Video — optional");
  expect(part).toContain("Your existing video is kept");
  expect(part).toContain('capture="environment"');
});
