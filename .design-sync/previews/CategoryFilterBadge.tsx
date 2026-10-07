import { CategoryFilterBadge } from "paisaxe";

const noop = () => {};
const backdrop = { backgroundImage: "linear-gradient(160deg, #6b8f71, #2a3a44)" };

export const Collapsed = () => (
  <div className="relative" style={{ width: 480, height: 140, ...backdrop }}>
    <CategoryFilterBadge
      currentCategory="nature"
      selectedCategory={null}
      selectedLocation={null}
      selectedDuration={null}
      onCategoryChange={noop}
      onLocationChange={noop}
      onDurationChange={noop}
      onClearAll={noop}
      visible
    />
  </div>
);

export const WithActiveFilters = () => (
  <div className="relative" style={{ width: 480, height: 140, ...backdrop }}>
    <CategoryFilterBadge
      currentCategory="nature"
      selectedCategory="food"
      selectedLocation="eastern"
      selectedDuration={null}
      onCategoryChange={noop}
      onLocationChange={noop}
      onDurationChange={noop}
      onClearAll={noop}
      visible
    />
  </div>
);
