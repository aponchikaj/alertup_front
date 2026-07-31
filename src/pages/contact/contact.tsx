import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ContactAPI } from "../../apis/contact";
import Seo from "../../seo/Seo";
import { breadcrumbJsonLd } from "../../seo/structuredData";
import { useI18n } from "../../i18n/LanguageProvider";
import { usePageAnimations } from "../../lib/animations";
import { PageShell } from "../../components/ui/layout";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { TextField, TextAreaField } from "../../components/ui/field";
import { MailIcon } from "../../components/ui/icons";

/** Explicit states. The previous code used the literal "Sent." as both the
 *  success sentinel and the message body, and the catch block set it too — so
 *  a network failure rendered the success alert. */
type Status = "idle" | "sent" | "error";

const Contact = () => {
  const rootRef = usePageAnimations();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const [contactData, setContactData] = useState(() => ({
    email: "",
    // Arriving from the Enterprise card on /pricing — start the reason for them.
    reason:
      searchParams.get("plan") === "enterprise"
        ? t("contact.reasonEnterprise")
        : "",
    message: "",
  }));

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setContactLoading(true);
    setStatus("idle");
    setErrorText("");

    try {
      const res = await ContactAPI(contactData);
      if (res?.Success === false) {
        setErrorText(res.Message || t("contact.failed"));
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setErrorText(t("contact.failed"));
      setStatus("error");
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div ref={rootRef}>
      <Seo
        jsonLd={[
          breadcrumbJsonLd([
            { name: t("common.home"), path: "/" },
            { name: t("contact.breadcrumb"), path: "/contact" },
          ]),
        ]}
      />

      <PageShell width="prose">
        <div data-hero>
          <Card className="p-7 sm:p-10">
            <div className="mb-7 flex flex-col items-center gap-3 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                <MailIcon size={24} />
              </span>
              <h1 className="text-2xl font-semibold text-ink sm:text-3xl">
                {t("contact.title")}
              </h1>
              <p className="max-w-md text-sm text-ink-muted sm:text-base">
                {t("contact.lead")}
              </p>
            </div>

            {status !== "idle" && (
              <Alert
                tone={status === "sent" ? "success" : "danger"}
                className="mb-5"
              >
                {status === "sent" ? t("contact.sent") : errorText}
              </Alert>
            )}

            <form onSubmit={sendMessage} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t("home.emailLabel")}
                  type="email"
                  autoComplete="email"
                  placeholder={t("common.emailPlaceholder")}
                  value={contactData.email}
                  onChange={(e) =>
                    setContactData({ ...contactData, email: e.target.value })
                  }
                  required
                />
                <TextField
                  label={t("home.reasonLabel")}
                  placeholder={t("home.reasonPlaceholder")}
                  value={contactData.reason}
                  onChange={(e) =>
                    setContactData({ ...contactData, reason: e.target.value })
                  }
                  required
                />
              </div>
              <TextAreaField
                label={t("home.messageLabel")}
                placeholder={t("home.messagePlaceholder")}
                rows={6}
                value={contactData.message}
                onChange={(e) =>
                  setContactData({ ...contactData, message: e.target.value })
                }
                required
              />
              <Button
                type="submit"
                size="lg"
                fullWidth
                loading={contactLoading}
                loadingLabel={t("common.sending")}
              >
                {t("common.send")}
              </Button>
            </form>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

export default Contact;
