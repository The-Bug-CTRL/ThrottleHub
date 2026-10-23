/** User-supplied category artwork. Descendants inherit their main category icon. */
export const categoryIconFiles = {
  motorcycles: "motocrossbike_icon.png",
  motocross: "motocrossbike_icon.png",
  enduro: "endurobike_icon.png",
  trials: "trialsbike_icon.png",
  trail: "trailbike_icon.png",
  "pit-bikes": "pitbike_icon.png",
  "kids-bikes": "kids_bike_icon.png",
  parts: "parts_icon.png",
  "riding-gear": "riding_gear_icon.png",
  electronics: "eletronics_icon.png",
  accessories: "equipment_icon.png",
  tools: "workshop_icon.png",
} as const;
export function categoryIconPath(category: string): string | null {
  const key = category.toLowerCase();
  const segments = key.split("/");
  let icon: keyof typeof categoryIconFiles | undefined;
  if (segments[0] === "motorcycles") {
    icon =
      segments[1] && Object.hasOwn(categoryIconFiles, segments[1])
        ? (segments[1] as keyof typeof categoryIconFiles)
        : "motorcycles";
  } else if (Object.hasOwn(categoryIconFiles, segments[0])) {
    icon = segments[0] as keyof typeof categoryIconFiles;
  }
  return icon ? `/catagories_icons/${categoryIconFiles[icon]}` : null;
}
