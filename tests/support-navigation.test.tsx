import { it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const role = vi.hoisted(() => ({ admin: false, checking: false, user: null }));
vi.mock("../src/components/use-role", () => ({ useRole: () => role }));
vi.mock("@/lib/firebase", () => ({ db: {} }));
import { AdministratorTools, CustomerSupportSettings, SupportBadge, SupportNotificationsProvider } from "../src/components/support-notifications";
function render() {
  return renderToStaticMarkup(<SupportNotificationsProvider><SupportBadge /><AdministratorTools /><CustomerSupportSettings /></SupportNotificationsProvider>);
}
it("keeps customer Support navigation without admin tools or a header alert button", () => {
  role.admin = false;
  const html = render();
  expect(html).toContain('href="/help"');
  expect(html).not.toContain('href="/admin/support"');
  expect(html).not.toContain("Administrator Tools");
  expect(html).toContain("Support reply alerts");
  const badge = html.slice(0, html.indexOf("</span>") + 7);
  expect(badge).not.toContain("<button");
});
it("shows verified admin navigation and honest foreground settings only after role checking", () => {
  role.admin = true;
  role.checking = false;
  const html = render();
  expect(html).toContain("Administrator Tools");
  expect(html).toContain('href="/admin/support"');
  expect(html).toContain("Support Notification Settings");
  expect(html).toContain('href="/admin/payments"');
  expect(html).toContain('href="/admin/community"');
  expect(html.indexOf("Administrator Dashboard")).toBeLessThan(html.indexOf("Manage Support Tickets"));
  expect(html.indexOf("Manage Support Tickets")).toBeLessThan(html.indexOf("Payment Review"));
  expect(html.indexOf("Payment Review")).toBeLessThan(html.indexOf("Moderation"));
  expect(html).toContain("Background push notifications are not enabled");
  expect(html).not.toContain("Support reply alerts");
  role.checking = true;
  expect(render()).not.toContain("Administrator Tools");
  role.checking = false;
});
