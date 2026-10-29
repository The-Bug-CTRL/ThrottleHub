import methods from "./delivery-methods.json";
import { categoryPath, requiresRunningVideo } from "./taxonomy";

export function deliveryOptions(categoryId: string) {
  const kind = requiresRunningVideo(categoryId) ? "motorcycle" : "parcel";
  return methods.flatMap((m) => m[kind] ? [{ id: m.id, label: m[kind]! }] : []);
}
export function compatibleDelivery(categoryId: string, selected: string[]) {
  const allowed = new Set(deliveryOptions(categoryId).map((m) => m.id));
  return selected.filter((id) => allowed.has(id));
}
export function validDelivery(categoryId: string, selected: string[]) {
  return selected.length <= 8 && new Set(selected).size === selected.length && compatibleDelivery(categoryId, selected).length === selected.length;
}
export function deliveryShipping(selected: string[]): "Collection only" | "Domestic shipping" {
  return selected.some((id) => !["collect", "meet"].includes(id)) ? "Domestic shipping" : "Collection only";
}
// Most specific matching ancestor wins, including retired category aliases.
const examples: Record<string, string> = {
  motorcycles: "2023 Yamaha YZ250",
  "motorcycles/motocross": "2023 Yamaha YZ250",
  "motorcycles/enduro": "2023 KTM 300 EXC",
  "motorcycles/trials": "Montesa Cota 4RT trials bike",
  "motorcycles/trail": "Yamaha TT-R230 trail bike",
  "motorcycles/pit-bikes": "Honda CRF110 pit bike",
  "motorcycles/kids-bikes": "Yamaha PW50 kids bike",
  parts: "Yamaha YZ250 spare parts",
  "parts/engine": "Yamaha YZ250 engine components",
  "parts/engine/top-end/cylinder-heads": "Yamaha YZ250 cylinder head",
  "parts/exhaust": "FMF Gnarly exhaust pipe",
  "parts/wheels-tyres": "Excel front wheel — 21 inch",
  "riding-gear": "Fox Racing riding gear — Size M",
  "riding-gear/helmets": "Bell Moto-9 Flex helmet — Size L",
  "riding-gear/boots": "Alpinestars Tech 7 boots — Size 10",
  "riding-gear/clothing": "Fox Racing motocross jersey — Size M",
  "riding-gear/clothing/riding-pants": "Fox Racing riding pants — Size 32",
  "riding-gear/clothing/jackets": "Alpinestars riding jacket — Size L",
  "riding-gear/protection": "Leatt knee guards — Size L",
  "riding-gear/gloves-goggles": "100% motocross goggles",
  "riding-gear/bags-hydration": "USWE hydration pack — 3 litre",
  electronics: "Garmin Montana 700 GPS",
  "electronics/cameras": "GoPro HERO action camera",
  "electronics/watches-wearables": "Garmin Instinct GPS watch",
  "electronics/communication": "Cardo helmet intercom",
  "electronics/power": "USB motorcycle charging kit",
  accessories: "Motorcycle tie-down straps — Pair",
  "accessories/riding": "Foldable paddock chair",
  tools: "Motorcycle maintenance tool kit",
  "tools/workshop": "Adjustable motorcycle workshop stand",
};
export function listingTitleExample(categoryId: string) {
  for (const category of categoryPath(categoryId).reverse()) {
    if (examples[category.id]) return `e.g. ${examples[category.id]}`;
  }
  return "e.g. Brand, item name and size or model";
}
