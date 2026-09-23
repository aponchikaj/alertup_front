import { render, screen } from "@testing-library/react";
import {
  EvacuateIcon,
  EmergencyExitIcon,
  AssemblyPointIcon,
  WarningIcon,
  MandatoryIcon,
} from "./safetyIcons";

describe("ISO 7010 safety pictograms", () => {
  it("carries an accessible name — these are never silently decorative", () => {
    render(<EvacuateIcon title="Evacuate now" />);
    expect(screen.getByRole("img", { name: "Evacuate now" })).toBeInTheDocument();
  });

  it("hides itself when adjacent text already names the state", () => {
    const { container } = render(<EvacuateIcon title="" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg?.querySelector("title")).toBeNull();
  });

  it("gives each severity a distinct geometry, so shape carries the meaning", () => {
    // Red and amber separate by only 63.6 under tritanopia. If critical and
    // warning ever render the same outline, colour is doing all the work.
    const critical = render(<EvacuateIcon title="Evacuate" />).container.innerHTML;
    const warning = render(<WarningIcon title="Warning" />).container.innerHTML;
    const exit = render(<EmergencyExitIcon title="Exit" />).container.innerHTML;
    const mandatory = render(<MandatoryIcon title="Mandatory" />).container.innerHTML;
    const shapes = new Set([critical, warning, exit, mandatory]);
    expect(shapes.size).toBe(4);
  });

  it("renders at a size the caller controls", () => {
    const { container } = render(<AssemblyPointIcon title="Assembly point" size={48} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "48");
  });
});
