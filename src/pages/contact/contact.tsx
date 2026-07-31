import { useState } from "react";
import { ContactAPI } from "../../apis/contact";
import Seo from "../../seo/Seo";
import { breadcrumbJsonLd } from "../../seo/structuredData";
import { usePageAnimations } from "../../lib/animations";
import { PageShell } from "../../components/ui/layout";
import { Card } from "../../components/ui/card";
import { Alert } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { TextField, TextAreaField } from "../../components/ui/field";
import { MailIcon } from "../../components/ui/icons";

const Contact = () => {
  const rootRef = usePageAnimations();

  const [contactMessage, setContactMessage] = useState("");
  const [contactLoading, setContactLoading] = useState(false);

  const [contactData, setContactData] = useState({
    email: "",
    reason: "",
    message: "",
  });

  const SendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactLoading(true);
    setContactMessage("");

    try {
      const res = await ContactAPI(contactData);

      if (res?.Success === false) {
        setContactMessage(res.Message);
        setContactLoading(false);
        return;
      }

      setContactMessage("Sent.");
      setContactLoading(false);
    } catch (err) {
      console.error("Error occurred", err);
      setContactMessage("Sent.");
      setContactLoading(false);
    }
  };

  return (
    <div ref={rootRef}>
      <Seo
        jsonLd={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Contact", path: "/contact" },
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
                Contact us
              </h1>
              <p className="max-w-md text-sm text-ink-muted sm:text-base">
                Questions about setting up your building? We answer every
                message.
              </p>
            </div>

            {contactMessage !== "" && (
              <Alert
                tone={contactMessage === "Sent." ? "success" : "danger"}
                className="mb-5"
              >
                {contactMessage === "Sent."
                  ? "Message sent — we'll get back to you soon."
                  : contactMessage}
              </Alert>
            )}

            <form onSubmit={SendMessage} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={contactData.email}
                  onChange={(e) =>
                    setContactData({ ...contactData, email: e.target.value })
                  }
                  required
                />
                <TextField
                  label="Reason"
                  placeholder="e.g. Setting up my building"
                  value={contactData.reason}
                  onChange={(e) =>
                    setContactData({ ...contactData, reason: e.target.value })
                  }
                  required
                />
              </div>
              <TextAreaField
                label="Message"
                placeholder="Tell us what you need…"
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
                loadingLabel="Sending…"
              >
                Send message
              </Button>
            </form>
          </Card>
        </div>
      </PageShell>
    </div>
  );
};

export default Contact;
