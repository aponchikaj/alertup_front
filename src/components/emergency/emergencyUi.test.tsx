import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmergencyOverlay } from "./EmergencyOverlay";
import { EmergencyBanner } from "./EmergencyBanner";
import { LanguageProvider } from "../../i18n/LanguageProvider";
import { en } from "../../i18n/messages/en";

const renderWithI18n = (ui: React.ReactElement) =>
  render(<LanguageProvider>{ui}</LanguageProvider>);

describe("EmergencyOverlay", () => {
  test("renders nothing while closed", () => {
    renderWithI18n(
      <EmergencyOverlay open={false} onShowRoute={jest.fn()} onBypass={jest.fn()} />,
    );
    expect(screen.queryByTestId("emergency-overlay")).not.toBeInTheDocument();
  });

  test("announces itself as an alert dialog and shows the building message", () => {
    renderWithI18n(
      <EmergencyOverlay
        open
        message="Fire on level 2 — use the north stairs"
        onShowRoute={jest.fn()}
        onBypass={jest.fn()}
      />,
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(en.emergency.overlayTitle)).toBeInTheDocument();
    expect(
      screen.getByText("Fire on level 2 — use the north stairs"),
    ).toBeInTheDocument();
    // The lift warning is not optional copy.
    expect(screen.getByText(en.emergency.doNotUseElevators)).toBeInTheDocument();
  });

  test("falls back to generic evacuation copy when no message is set", () => {
    renderWithI18n(
      <EmergencyOverlay open message="   " onShowRoute={jest.fn()} onBypass={jest.fn()} />,
    );
    expect(screen.getByText(en.emergency.overlayBodyDefault)).toBeInTheDocument();
  });

  test("offers both routes out: show the way, or acknowledge and continue", async () => {
    const onShowRoute = jest.fn();
    const onBypass = jest.fn();
    renderWithI18n(
      <EmergencyOverlay open onShowRoute={onShowRoute} onBypass={onBypass} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: en.emergency.showRoute }),
    );
    expect(onShowRoute).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: en.emergency.bypass }));
    expect(onBypass).toHaveBeenCalledTimes(1);
  });

  test("Escape does not dismiss it — leaving requires an explicit choice", async () => {
    const onBypass = jest.fn();
    renderWithI18n(
      <EmergencyOverlay open onShowRoute={jest.fn()} onBypass={onBypass} />,
    );

    await userEvent.keyboard("{Escape}");

    expect(screen.getByTestId("emergency-overlay")).toBeInTheDocument();
    expect(onBypass).not.toHaveBeenCalled();
  });
});

describe("EmergencyBanner", () => {
  test("stays visible with a live region and a way back to the route", async () => {
    const onViewRoute = jest.fn();
    renderWithI18n(<EmergencyBanner onViewRoute={onViewRoute} />);

    const banner = screen.getByTestId("emergency-banner");
    expect(banner).toHaveAttribute("role", "status");
    expect(screen.getByText(en.emergency.bannerText)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: en.emergency.bannerAction }),
    );
    expect(onViewRoute).toHaveBeenCalledTimes(1);
  });

  test("renders without an action when none is supplied", () => {
    renderWithI18n(<EmergencyBanner />);
    expect(screen.getByText(en.emergency.bannerText)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
