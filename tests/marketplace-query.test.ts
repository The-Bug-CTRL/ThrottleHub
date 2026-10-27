import { expect, it } from "vitest";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { queryMarketplace } from "../src/lib/marketplace-search";
import { defaultFilters } from "../src/lib/search-contract";
import { categoryFields } from "../src/lib/taxonomy";
import { listing, testProject } from "./fixtures";
it.skipIf(process.env.RUN_FIREBASE_TESTS !== "true")(
  "queries actual descendants, combined filters, stable cursors and sparse pages in isolated Firestore",
  async () => {
    if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180")
      throw Error("Isolated test emulator required");
    const app = initializeApp({ projectId: testProject }, "marketplace-query");
    const db = getFirestore(app);
    const prefix = "v2-query-" + crypto.randomUUID();
    const refs = [];
    try {
      const batch = db.batch();
      for (let i = 0; i < 145; i++) {
        const id = prefix + "-" + String(i).padStart(3, "0");
        const ref = db.collection("listings").doc(id);
        refs.push(ref);
        batch.set(ref, {
          ...listing("query-seller", id),
          ...categoryFields("parts/engine/top-end/cylinder-heads"),
          searchTokens: [
            ...listing().searchTokens,
            ...(i < 132 ? ["honda", "cr125"] : ["yamaha", "yz250"]),
          ],
          make: i < 132 ? "Honda" : "Yamaha",
          model: i < 132 ? "CR125" : "YZ250",
          year: 0,
          createdAt: 1000,
          details: {
            ...listing().details,
            yearFrom: 2003,
            yearTo: 2007,
            engineType: "two-stroke",
            displacement: 250,
          },
        });
      }
      const foreign = db.collection("listings").doc(prefix + "-foreign");
      refs.push(foreign);
      batch.set(foreign, {
        ...listing("query-seller", foreign.id),
        country: "GB",
        currency: "GBP",
      });
      await batch.commit();
      const f = {
        ...defaultFilters,
        category: "parts/engine",
        make: "Yamaha",
        model: "YZ250",
        year: "2005",
        region: "ZA-GP",
        engineType: "two-stroke",
        sort: "oldest",
      };
      const typed = await queryMarketplace(db, {
        ...defaultFilters,
        category: "parts/engine",
        term: "Yamaha YZ250",
      });
      expect(typed.items).toHaveLength(8);
      expect(typed.items.every((item) => item.make === "Yamaha")).toBe(true);
      const noMatch = await queryMarketplace(db, {
        ...defaultFilters,
        category: "parts/engine",
        term: "Yamaha helmet",
      });
      expect(noMatch.items).toHaveLength(0);
      const first = await queryMarketplace(db, f);
      expect(first.items).toHaveLength(0);
      expect(first.scanned).toBe(128);
      expect(first.more).toBe(true);
      const second = await queryMarketplace(db, f, first.cursor);
      expect(second.items).toHaveLength(8);
      const third = await queryMarketplace(db, f, second.cursor);
      expect(third.items).toHaveLength(5);
      expect(third.more).toBe(false);
      expect(
        new Set([...second.items, ...third.items].map((l) => l.id)).size,
      ).toBe(13);
      const sibling = await queryMarketplace(db, {
        ...f,
        category: "parts/engine/top-end/pistons",
      });
      expect(sibling.items).toHaveLength(0);
      const keyword = await queryMarketplace(db, { ...f, term: "permis" });
      const keywordNext = await queryMarketplace(
        db,
        { ...f, term: "permis" },
        keyword.cursor,
      );
      expect(keywordNext.items).toHaveLength(8);
      await expect(
        queryMarketplace(db, { ...f, year: "1995" }, second.cursor),
      ).rejects.toThrow("Search changed");
      const exact = await queryMarketplace(db, {
        ...f,
        sort: "price-asc",
        min: "50",
        max: "150",
      });
      expect(exact.items.length).toBe(0);
      expect(exact.more).toBe(true);
    } finally {
      const cleanup = db.batch();
      refs.forEach((r) => cleanup.delete(r));
      await cleanup.commit();
      await deleteApp(app);
    }
  },
  60000,
);
