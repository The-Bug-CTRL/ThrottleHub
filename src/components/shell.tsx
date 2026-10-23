"use client";
import Link from "next/link";
import Image from "next/image";
import headerLogo from "../../public/branding/ThrottleHublogo.png";
import { usePathname } from "next/navigation";
import {
  Heart,
  Menu,
  MessageCircle,
  Plus,
  User,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useRef, useState, Fragment, Suspense } from "react";
import { categoryChildren, categoryHref } from "@/lib/taxonomy";
import { brand } from "@/lib/config";
import { configurationError } from "@/lib/firebase-settings";
import { Notifications } from "./notifications";
import { CategoryIcon } from "./category-icon";
import { CategoryDropdowns } from "./category-dropdowns";
import { useSession } from "./session";
import { MarketplaceSearchBar } from "./marketplace-search-bar";
import { MemberAvatar } from "./member-avatar";
import { SearchDraftProvider } from "./search-draft";
// Separate this header rendition from previously cached optimizer responses.
// The static import still fingerprints future changes to the original PNG.
const headerLogoSource = {
  ...headerLogo,
  src: `${headerLogo.src}?variant=header-contain`,
};
const navigation = [
  ["/browse", "Marketplace"],
  ["/forum", "Forum"],
  ["/news", "News"],
  ["/stolen-bikes", "Stolen bikes"],
  ["/events", "Events"],
];
export function Shell({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const marketplace =
    pathname === "/" ||
    ["/browse", "/marketplace", "/listing", "/sell"].some((p) =>
      pathname.startsWith(p),
    );
  return (
    <SearchDraftProvider>
      <>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link
              className="wordmark"
              href="/"
              aria-label={`${brand.name} home`}
              style={{
                aspectRatio: `${headerLogo.width} / ${headerLogo.height}`,
              }}
            >
              <Image
                src={headerLogoSource}
                alt={brand.name}
                className="header-logo object-contain"
                fill
                style={{
                  objectFit: "contain",
                  objectPosition: "center",
                  width: "100%",
                  height: "100%",
                }}
                sizes="(max-width: 640px) 108px, (max-width: 1050px) 144px, 180px"
                priority
              />
            </Link>
            <nav className="desktop-nav" aria-label="Main navigation">
              {navigation.map(([href, label]) => {
                const active =
                  href === "/browse" ? marketplace : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                  >
                    {label}
                  </Link>
                );
              })}
              <details
                className="more-navigation"
                onKeyDown={(event) => {
                  if (event.key === "Escape") event.currentTarget.open = false;
                }}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    event.currentTarget.open = false;
                }}
              >
                <summary>More</summary>
                <nav aria-label="Extra sections">
                  <Link
                    href="/jobs"
                    onClick={(event) =>
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    Jobs
                  </Link>
                  <Link
                    href="/entries-services"
                    onClick={(event) =>
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                    }
                  >
                    Entries &amp; services
                  </Link>
                </nav>
              </details>
            </nav>
            <div className="header-actions">
              <Notifications />
              <Link
                className="header-icon desktop-extra"
                href="/account?tab=favourites"
                aria-label="Saved favourites"
              >
                <Heart size={19} />
              </Link>
              <Link
                className="header-icon desktop-extra"
                href="/messages"
                aria-label="Your messages"
              >
                <MessageCircle size={19} />
              </Link>
              <Link
                className="account-link"
                href={user ? "/account" : "/auth"}
                aria-label={user ? "My account" : "Sign in"}
              >
                {user ? <MemberAvatar user={user} /> : <User size={19} />}
                <span className="account-label">
                  {user ? "My account" : "Sign in"}
                </span>
              </Link>
              <Link className="button header-sell" href="/sell">
                <Plus size={18} />
                <span>Sell an item</span>
              </Link>
              <button
                ref={toggle}
                className="header-icon mobile-menu"
                aria-label="Open navigation"
                aria-expanded={open}
                aria-controls="mobile-navigation"
                onClick={() => setOpen(true)}
              >
                <Menu size={23} />
              </button>
            </div>
          </div>
        </header>
        {marketplace && (
          <div className="market-nav">
            <div className="wrap">
              <CategoryDropdowns />
            </div>
          </div>
        )}
        <Suspense
          fallback={
            <div
              className="market-search-placeholder"
              aria-label="Loading marketplace search"
            />
          }
        >
          <MarketplaceSearchBar />
        </Suspense>
        <dialog
          id="mobile-navigation"
          className="nav-dialog"
          ref={dialog}
          aria-label="ThrottleHub navigation"
          onCancel={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="drawer-heading">
            <Link
              className="wordmark"
              style={{
                aspectRatio: `${headerLogo.width} / ${headerLogo.height}`,
              }}
              href="/"
              aria-label={`${brand.name} home`}
              onClick={() => setOpen(false)}
            >
              <Image
                src={headerLogoSource}
                alt={brand.name}
                className="header-logo object-contain"
                fill
                style={{
                  objectFit: "contain",
                  objectPosition: "center",
                  width: "100%",
                  height: "100%",
                }}
                sizes="(max-width: 640px) 108px, 144px"
              />
            </Link>
            <button
              className="icon-button"
              aria-label="Close navigation"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
            >
              <X />
            </button>
          </div>

          <nav aria-label="Mobile navigation">
            {navigation.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
                <ArrowUpRight size={17} />
              </Link>
            ))}
          </nav>
          <nav aria-label="Extra sections">
            <Link href="/jobs" onClick={() => setOpen(false)}>
              Jobs
              <ArrowUpRight size={17} />
            </Link>
            <Link href="/entries-services" onClick={() => setOpen(false)}>
              Entries &amp; services
              <ArrowUpRight size={17} />
            </Link>
          </nav>
          <div className="drawer-categories">
            <div className="eyebrow">Find your next</div>
            {categoryChildren().map((c) => (
              <Link
                key={c.id}
                href={categoryHref(c.id)}
                onClick={() => setOpen(false)}
              >
                <CategoryIcon category={c.id} size={32} />
                {c.name}
              </Link>
            ))}
          </div>
          <div className="drawer-account">
            <Link
              href={user ? "/account" : "/auth"}
              onClick={() => setOpen(false)}
            >
              {user ? <MemberAvatar user={user} /> : <User size={18} />}
              {user ? "My garage & profile" : "Sign in / create account"}
            </Link>
            <Link href="/account/saved-searches" onClick={() => setOpen(false)}>
              Saved searches
            </Link>
            <Link href="/messages" onClick={() => setOpen(false)}>
              <MessageCircle size={18} />
              Messages
            </Link>
            <Link
              className="button"
              href="/sell"
              onClick={() => setOpen(false)}
            >
              <Plus size={17} />
              Sell an item
            </Link>
          </div>
        </dialog>
        <main id="main-content" tabIndex={-1}>
          {configurationError ? (
            <section className="wrap section">
              <div className="eyebrow">Connection required</div>
              <h1>Your community starts here.</h1>
              <p className="notice error" role="alert">
                {configurationError}
              </p>
              <p>
                Connect the local Firebase services to browse and publish real
                content. See the project’s setup instructions.
              </p>
            </section>
          ) : (
            <Fragment
              key={
                pathname === "/auth" ? "auth-flow" : user?.uid || "signed-out"
              }
            >
              {children}
            </Fragment>
          )}
        </main>
        <footer className="site-footer">
          <div className="wrap footer-grid">
            <div className="footer-intro">
              <Link className="footerbrand" href="/">
                {brand.name}
                <span>.</span>
              </Link>
              <p>
                For the bikes. For the riders.
                <br />
                For everything off-road.
              </p>
              <small>South Africa’s off-road marketplace.</small>
            </div>
            <div>
              <b>Marketplace</b>
              <Link href="/browse?category=Motorcycles">
                Browse motorcycles
              </Link>
              <Link href="/browse?category=Parts">Parts & components</Link>
              <Link href="/browse?category=Riding%20Gear">Riding gear</Link>
              <Link href="/sell">Sell an item</Link>
            </div>
            <div>
              <b>Community</b>
              <Link href="/jobs">Jobs</Link>
              <Link href="/entries-services">Entries & services</Link>
              {navigation.slice(1).map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
              <Link href="/info/about">About {brand.name}</Link>
            </div>
            <div>
              <b>Ride with confidence</b>
              <Link href="/policies/rules">Marketplace safety</Link>
              <Link href="/info/help">Help & getting started</Link>
              <Link href="/info/contact">Contact</Link>
              <Link href="/policies/privacy">Privacy notice</Link>
              <Link href="/policies/terms">Terms of use</Link>
            </div>
          </div>
          <div className="wrap footer-bottom">
            <span>
              © {new Date().getFullYear()} {brand.name}
            </span>
          </div>
        </footer>
      </>
    </SearchDraftProvider>
  );
}
