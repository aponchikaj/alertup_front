import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloorSwitcher, RouteStepList, IconTiles } from "./wayfinding";
import { SearchField } from "./searchField";
import { ScoreBar, StatRow } from "./stats";

const FLOORS = [
  { id: "b1", label: "B1" },
  { id: "g", label: "G" },
  { id: "1", label: "1" },
];

describe("FloorSwitcher", () => {
  it("is a radiogroup, so a keyboard user gets floor semantics not a button soup", () => {
    render(<FloorSwitcher floors={FLOORS} current="g" onChange={jest.fn()} />);
    expect(screen.getByRole("radiogroup", { name: "Floor" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "G" })).toBeChecked();
  });

  it("reports the chosen floor", async () => {
    const onChange = jest.fn();
    render(<FloorSwitcher floors={FLOORS} current="g" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "1" }));
    expect(onChange).toHaveBeenCalledWith("1");
  });
});

describe("RouteStepList", () => {
  const steps = [
    { id: "a", instruction: "Walk to the end of the corridor", icon: <span />, distance: "20 m" },
    { id: "b", instruction: "Take the lift to floor 3", icon: <span />, floor: "3" },
  ];

  it("marks the current step for assistive tech, not just visually", () => {
    render(<RouteStepList steps={steps} currentIndex={1} />);
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("numbers each step in text, so the order survives a screen reader", () => {
    render(<RouteStepList steps={steps} />);
    expect(screen.getByText("Step 1:")).toBeInTheDocument();
    expect(screen.getByText("Step 2:")).toBeInTheDocument();
  });
});

describe("IconTiles", () => {
  it("renders every tile as a real button", () => {
    render(
      <IconTiles
        tiles={[
          { id: "shops", label: "Find a shop", icon: <span /> },
          { id: "exits", label: "Exits", icon: <span /> },
        ]}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Find a shop/ })).toBeInTheDocument();
  });
});

describe("SearchField", () => {
  it("is a labelled combobox even though the label is visually hidden", () => {
    render(<SearchField label="Search this building" />);
    expect(screen.getByRole("combobox", { name: "Search this building" })).toBeInTheDocument();
  });

  it("opens suggestions on focus and selects with the keyboard", async () => {
    const onSelect = jest.fn();
    render(
      <SearchField
        label="Search"
        value="ph"
        onChange={() => {}}
        suggestions={[
          { id: "1", label: "Pharmacy", detail: "Floor 2" },
          { id: "2", label: "Phone repair", detail: "Floor 1" },
        ]}
        onSelectSuggestion={onSelect}
      />,
    );
    const input = screen.getByRole("combobox");
    await userEvent.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ label: "Pharmacy" }));
  });

  it("offers a clear control once there is something to clear", () => {
    render(<SearchField label="Search" value="cafe" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });
});

describe("ScoreBar", () => {
  it("states the grade in text, so colour is never the only signal", () => {
    render(<ScoreBar grade="B" label="Coverage" />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-valuetext", "Coverage: grade B");
  });
});

describe("StatRow", () => {
  it("renders each value with its caption", () => {
    render(<StatRow stats={[{ value: "98%", caption: "Routes completed" }]} />);
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByText("Routes completed")).toBeInTheDocument();
  });
});
