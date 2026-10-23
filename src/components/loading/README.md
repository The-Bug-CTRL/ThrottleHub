# ThrottleHub rear-wheel loader

The preferred loader is a single standalone rear wheel with aggressive brown roost. All bike structure, chain and sprocket artwork has been removed. The SVG and wrapper have no background; spoke spaces also have real transparency.

```tsx
import { RoostLoader } from "@/components/loading/roost-loader";

{
  isPending && <RoostLoader size="small" label="Searching listings" />;
}
```

Sizes: `small` (88px), `large` (280px), or a numeric width in pixels. Height scales automatically. The label announces the operation; avoid nesting it inside another live region. There is one design, with no variant prop.

Mount directly from genuine pending state and remove immediately on success, error or cancellation. The component owns no timer or network request and never delays completion.

Clockwise rotation corresponds to forward travel toward the right, throwing dirt left from the contact patch. Tapered trails and angular particles animate independently with negative staggered delays, opacity and transforms. Wheel rotation is linear and repeats at 360 degrees. No filters, bitmap layers or animation dependencies are used. Reduced-motion users see a static wheel and composed dirt spray.

The shared `LoadingState` uses this artwork throughout route loading, feeds, account checks, searches and uploads. Use its default 112px size for sections, 144–192px for page loading, 64px for upload/status rows, and `RoostLoader` directly at 40–48px within pending buttons. Preserve upload percentages as visible text. Fine mechanical detail naturally simplifies at compact sizes.

The development loading lab has been removed; `/dev/loading-lab` now returns 404. This is the site's standard loading animation.
