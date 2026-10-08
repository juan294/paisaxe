import { Logo } from "paisaxe";

export const OnDark = () => (
  <div className="flex items-center gap-8 p-8">
    <div className="h-16 w-16 text-primary">
      <Logo />
    </div>
    <div className="h-16 w-16 text-white">
      <Logo />
    </div>
  </div>
);

export const CustomColors = () => (
  <div className="flex items-center gap-8 p-8 bg-white">
    <div className="h-16 w-16">
      <Logo primaryColor="#15803d" secondaryColor="#86efac" />
    </div>
  </div>
);
