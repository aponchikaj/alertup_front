import { render, screen } from "@testing-library/react";
import { TextField } from "./field";

describe("TextField", () => {
  it("renders a visible label, never a placeholder standing in for one", () => {
    render(<TextField label="Building name" name="building" />);
    expect(screen.getByLabelText("Building name")).toBeInTheDocument();
  });

  it("ties the error to the input and marks it invalid", () => {
    render(<TextField label="Email" name="email" error="Enter a valid email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Enter a valid email",
    );
  });

  it("pairs the error with an icon — colour alone never carries a state", () => {
    render(<TextField label="Email" name="email" error="Enter a valid email" />);
    // Red and amber separate by only 4.2 under tritanopia. A red error message
    // with no icon is invisible as an error to a large number of people.
    const errorNode = screen.getByRole("alert");
    expect(errorNode.querySelector("svg")).toBeTruthy();
  });

  it("announces the error the moment it renders", () => {
    render(<TextField label="Email" name="email" error="Enter a valid email" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
  });
});
