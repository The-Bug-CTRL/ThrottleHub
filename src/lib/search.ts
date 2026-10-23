import { Filters, SearchCursor } from "./search-contract";
export {
  defaultFilters,
  filtersFromParams,
  filtersUrl,
} from "./search-contract";
export type { Filters } from "./search-contract";
export async function searchListings(filters: Filters, cursor?: SearchCursor) {
  const response = await fetch("/api/marketplace/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters, cursor }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Search unavailable. Please try again.");
  return result as {
    items: import("./models").Listing[];
    cursor?: SearchCursor;
    more: boolean;
    scanned: number;
  };
}
