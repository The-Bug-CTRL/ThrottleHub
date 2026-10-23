import type { UseFormRegister } from "react-hook-form";
import type { ListingInput } from "@/lib/models";
import { categoryById, ItemType } from "@/lib/taxonomy";
export function ListingDetailsFields({
  register,
  itemType,
  categoryId,
}: {
  register: UseFormRegister<ListingInput>;
  itemType?: ItemType;
  categoryId: string;
}) {
  const mechanical = itemType === "motorcycle" || itemType === "part";
  const engineTypes = categoryById[categoryId]?.engineTypes || [
    "two-stroke",
    "four-stroke",
  ];
  return (
    <details className="optional-item-details">
      <summary>Optional item details and compatibility</summary>
      <fieldset className="listing-attributes">
        <legend>
          Item details <small>Optional, unless stated</small>
        </legend>
        {mechanical && (
          <>
            <div className="field-row">
              <label>
                Engine type
                <select {...register("details.engineType")}>
                  <option value="">Unknown / not applicable</option>
                  {engineTypes.map((t) => (
                    <option key={t} value={t}>
                      {t === "two-stroke" ? "Two-stroke" : "Four-stroke"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Displacement (cc, 0 = unknown)
                <input type="number" {...register("details.displacement")} />
              </label>
              {itemType === "motorcycle" && (
                <label>
                  Engine hours (0 = unknown)
                  <input type="number" {...register("details.hours")} />
                </label>
              )}
            </div>
            <label>
              Fuel system
              <select {...register("details.fuelSystem")}>
                <option value="">Unknown / not applicable</option>
                <option value="carburettor">Carburettor</option>
                <option value="fuel-injection">Fuel injection</option>
              </select>
            </label>
            <label>
              Vintage item
              <select
                {...register("details.vintage", {
                  setValueAs: (v) => v === "true" || v === true,
                })}
              >
                <option value="false">No / unknown</option>
                <option value="true">Yes</option>
              </select>
            </label>
          </>
        )}
        {itemType === "part" && (
          <>
            <p>
              Fitment is your claim, not independently verified. Leave years at
              0 if unknown; do not assume every model year fits.
            </p>
            <div className="field-row">
              <label>
                Compatible from year
                <input type="number" {...register("details.yearFrom")} />
              </label>
              <label>
                Compatible to year
                <input type="number" {...register("details.yearTo")} />
              </label>
            </div>
            <label>
              Part origin
              <select {...register("details.origin")}>
                <option value="">Unknown</option>
                <option>OEM</option>
                <option value="aftermarket">Aftermarket</option>
              </select>
            </label>
            <label>
              Manufacturer part number
              <input {...register("details.partNumber")} maxLength={100} />
            </label>
          </>
        )}
        {itemType !== "motorcycle" && (
          <label>
            Brand
            <input {...register("details.brand")} maxLength={80} />
          </label>
        )}
        {itemType === "gear" && (
          <div className="field-row">
            <label>
              Size (helmet, clothing or boots)
              <input {...register("details.size")} maxLength={40} />
            </label>
            <label>
              Size system
              <select {...register("details.sizeSystem")}>
                <option value="">Not specified</option>
                {["UK", "US", "EU", "alpha", "cm"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <label>
          Seller type (self-declared)
          <select {...register("details.sellerType")}>
            <option value="private">Private seller</option>
            <option value="dealer">Dealership</option>
          </select>
        </label>
      </fieldset>
    </details>
  );
}
