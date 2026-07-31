import { useEffect, useState } from "react";
import {
  getSettings,
  saveSettings,
  changeUserPassword,
  sendNewEmailVerification,
  verifyNewEmailCode,
  sendVerificationCode,
  verifyAccountCode,
  deleteAccount,
  logoutFromAccount
} from "../../apis/settings";
import {enable2fa,deactivate2fa,verify2fa} from '../../apis/twoFactorAuth'
import { useNavigate } from "react-router-dom";
import { usePageAnimations } from "../../lib/animations";
import { PageShell, PageHeader } from "../../components/ui/layout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from "../../components/ui/card";
import { Alert, Skeleton } from "../../components/ui/feedback";
import { Button } from "../../components/ui/button";
import { TextField, PasswordField } from "../../components/ui/field";
import {
  LogOutIcon,
  LockIcon,
  MailIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from "../../components/ui/icons";

const Settings = () => {
  const rootRef = usePageAnimations();
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const [userData, setUserData] = useState<any>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [newEmailStep, setNewEmailStep] = useState(1);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailCode, setNewEmailCode] = useState("");

  const [accountVerificationCodeStep, setAccountVerificationCodeStep] = useState(1);
  const [accountVerificationCode, setAccountVerificationCode] = useState("");

  const [userPassword, setUserPassword] = useState("");

  // Initialized to "" so the input is controlled from the first render; an
  // undefined initial value flips it from uncontrolled to controlled on the
  // first keystroke, which React warns about.
  const [twoFaCode,setTwoFaCode] = useState<string>("")
  const [twoFaMode,setTwoFaMode] = useState("")
  const [twoFaSent,setTwoFaSent] = useState(false)

  useEffect(() => {
    setLoading(true);
    setServerError("");

    const getUserSettings = async () => {
      try {
        const res: any = await getSettings();
        if (!res || res.Success === false) {
          setServerError(res?.Message || "Something went wrong.");
          return;
        }
        setUserData(res.Message);
      } catch {
        setServerError("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    getUserSettings();
  }, []);

  const activate2FA = async()=>{
    try{
      const res = await enable2fa()
      if(!res) {setServerError("Something went wrong."); return;}
      if(res.Success==false) {setServerError(res.Message); return;}
      setTwoFaMode("activate")
      setTwoFaSent(true)
      return;
    }catch{
      setServerError("Something went wrong.")
    }
  }

  const deactivate2FA = async()=>{
    try{
      const res = await deactivate2fa()
      if(!res) {setServerError("Something went wrong."); return;}
      if(res.Success==false){setServerError(res.Message);return;}
      setTwoFaMode("deactivate")
      setTwoFaSent(true)
      return;
    }catch{console.log("Something went wrong.");setServerError("Something went wrong.")}
  }

  const verify2FA = async()=>{
    try{
      const res = await verify2fa({verificationCode:twoFaCode,verificationType:twoFaMode})
      if(!res){setServerError("Something went wrong.");return;}
      if(res.Success==false){setServerError(res.Message);return;}

      window.location.reload();
      return;
    }catch{
      console.log("Something went wrong.")
      setServerError("Something went wrong.")
    }
  }

  const saveUserSettings = async () => {
    setLoading(true);
    setServerError("");
    try {
      const res = await saveSettings(userData);
      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        return;
      }
      window.location.reload();
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    setLoading(true);
    setServerError("");
    try {
      const res = await changeUserPassword({ oldPassword, newPassword });
      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        return;
      }
      setServerError("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const NewEmail = async () => {
    setLoading(true);
    setServerError("");
    try {
      let res;
      if (newEmailStep === 1) {
        res = await sendNewEmailVerification({ newEmail });
        // Advanced only on success. Moving to step 2 before checking the
        // response showed the code-entry form even when the send had failed.
        if (res?.Success) setNewEmailStep(2);
      } else if (newEmailStep === 2) {
        // newEmail is deliberately kept until the change is confirmed. Clearing
        // it here meant one mistyped code left newEmail empty, so every retry
        // submitted an empty address and could never succeed.
        res = await verifyNewEmailCode({ newEmail, userCode: newEmailCode });
      }

      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        return;
      }

      if (newEmailStep === 2) {
        setNewEmail("");
        setNewEmailCode("");
        setNewEmailStep(1);
      }
      setServerError("Success!");
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const verifyAccount = async () => {
    setLoading(true);
    setServerError("");
    try {
      let res;
      if (accountVerificationCodeStep === 1) {
        res = await sendVerificationCode();
        // Advanced only on success. Stepping forward unconditionally meant a
        // failed send (rate limit, network) still swapped the button to
        // "Verify Account", with no way to request a new code short of a reload.
        if (res?.Success) setAccountVerificationCodeStep(2);
      } else if (accountVerificationCodeStep === 2) {
        res = await verifyAccountCode({ userCode: accountVerificationCode });
      }

      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        return;
      }

      if (accountVerificationCodeStep === 2) {
        setAccountVerificationCode("");
        window.location.reload();
        return;
      }
      setServerError("Success!");
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const deleteUserAccount = async () => {
    setLoading(true);
    setServerError("");
    try {
      const res = await deleteAccount({ password: userPassword });
      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        return;
      }
      setServerError("Account deleted successfully!");
      navigate('/')
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setServerError("");
    try {
      const res = await logoutFromAccount();
      console.log(res)
      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        return;
      }
      navigate('/')
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  /* Presentation only: serverError doubles as a success channel upstream, so
     the tone is derived from the message text. */
  const statusTone = /success/i.test(serverError) ? "success" : "danger";

  return (
    <div ref={rootRef}>
      <PageShell width="prose">
        <div data-hero>
          <PageHeader
            title="Settings"
            description="Manage your profile, security, and account."
          />
        </div>

        <div className="flex flex-col gap-6 pt-8">
          {loading && (
            <div
              className="flex flex-col gap-6"
              aria-busy="true"
              aria-label="Loading settings"
            >
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </div>
          )}
          {serverError && <Alert tone={statusTone}>{serverError}</Alert>}

          {userData && (
            <div className="flex flex-col gap-6" data-reveal-group>

              {/* ACCOUNT VERIFICATION */}
              {
                userData.verified == false ?
                <div data-reveal-item className="animate-fade-up">
                  <Card className="border-warning-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-warning-subtle text-warning-text">
                          <ShieldCheckIcon size={18} />
                        </span>
                        Verify account
                      </CardTitle>
                      <CardDescription>
                        Confirm your email address to unlock every feature.
                      </CardDescription>
                    </CardHeader>
                    <CardBody className="flex flex-col gap-4">
                      {accountVerificationCodeStep === 2 && (
                        <TextField
                          label="Verification Code"
                          value={accountVerificationCode}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          onChange={(e:any) => setAccountVerificationCode(e.target.value)}
                        />
                      )}
                      <Button onClick={verifyAccount} fullWidth>
                        {accountVerificationCodeStep === 1 ? "Send Code" : "Verify Account"}
                      </Button>
                    </CardBody>
                  </Card>
                </div>
                : null
              }

              {/* USER INFO */}
              <div data-reveal-item className="animate-fade-up">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                        <UserIcon size={18} />
                      </span>
                      Profile info
                    </CardTitle>
                    <CardDescription>
                      How you appear across AlertUp.
                    </CardDescription>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    {
                      userData.userType == "Individual" ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Name"
                            value={userData.name}
                            onChange={(e:any) => setUserData({ ...userData, name: e.target.value })}
                          />
                          <TextField
                            label="Lastname"
                            value={userData.lastname}
                            onChange={(e:any) => setUserData({ ...userData, lastname: e.target.value })}
                          />
                        </div>
                      ) : (
                        <TextField
                          label="Company"
                          value={userData.company}
                          onChange={(e:any) => setUserData({ ...userData, company: e.target.value })}
                        />
                      )
                    }
                    <TextField
                      label="Phone"
                      value={userData.phone}
                      onChange={(e:any) => setUserData({ ...userData, phone: e.target.value })}
                    />
                    <TextField
                      label="Country"
                      value={userData.country}
                      onChange={(e:any) => setUserData({ ...userData, country: e.target.value })}
                    />

                    <Button onClick={saveUserSettings} fullWidth>
                      Save Profile
                    </Button>
                  </CardBody>
                </Card>
              </div>

              {/* 2FA ON / OFF */}
              <div data-reveal-item className="animate-fade-up">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                        <ShieldCheckIcon size={18} />
                      </span>
                      Two-factor authentication
                    </CardTitle>
                    <CardDescription>Make your account safer</CardDescription>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    {
                      userData.TwoFactorEnabled == false && twoFaSent==false && (
                        <Button onClick={activate2FA} fullWidth>Activate</Button>
                      )
                    }

                    {
                      userData.TwoFactorEnabled == true && twoFaSent==false && (
                        <Button onClick={deactivate2FA} variant="secondary" fullWidth>Deactivate</Button>
                      )
                    }

                    {
                      twoFaSent == true && (
                        <>
                        <TextField maxLength={6} label="Code" type="number" value={twoFaCode} onChange={(e:any)=>{
                          setTwoFaCode(e.target.value)
                        }} />
                        <Button onClick={verify2FA} fullWidth>Submit</Button>
                        </>
                      )
                    }
                  </CardBody>
                </Card>
              </div>

              {/* CHANGE PASSWORD */}
              <div data-reveal-item className="animate-fade-up">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                        <LockIcon size={18} />
                      </span>
                      Change password
                    </CardTitle>
                    <CardDescription>
                      Use a long, unique password you don't reuse elsewhere.
                    </CardDescription>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    <PasswordField
                      label="Old Password"
                      value={oldPassword}
                      onChange={(e:any) => setOldPassword(e.target.value)}
                    />
                    <PasswordField
                      label="New Password"
                      value={newPassword}
                      onChange={(e:any) => setNewPassword(e.target.value)}
                    />
                    <Button onClick={changePassword} fullWidth>
                      Change Password
                    </Button>
                  </CardBody>
                </Card>
              </div>

              {/* EMAIL CHANGE */}
              <div data-reveal-item className="animate-fade-up">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-subtle text-brand-text">
                        <MailIcon size={18} />
                      </span>
                      Change email
                    </CardTitle>
                    <CardDescription>
                      We'll send a verification code to the new address.
                    </CardDescription>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    {newEmailStep === 1 && (
                      <TextField
                        label="New Email"
                        value={newEmail}
                        type={"email"}
                        onChange={(e:any) => setNewEmail(e.target.value)}
                      />
                    )}
                    {newEmailStep === 2 && (
                      <TextField
                        label="Verification Code"
                        value={newEmailCode}
                        type={"number"}
                        onChange={(e:any) => setNewEmailCode(e.target.value)}
                      />
                    )}
                    <Button onClick={NewEmail} fullWidth>
                      {newEmailStep === 1 ? "Send Verification Code" : "Verify Email"}
                    </Button>
                  </CardBody>
                </Card>
              </div>

              {/* DANGER ZONE — DELETE ACCOUNT */}
              <div data-reveal-item className="animate-fade-up">
                <Card className="border-danger-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5 text-danger-text">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-danger-subtle text-danger-text">
                        <TrashIcon size={18} />
                      </span>
                      Delete account
                    </CardTitle>
                    <CardDescription>
                      This permanently removes your account and its data.
                    </CardDescription>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    <PasswordField
                      label="Password"
                      value={userPassword}
                      onChange={(e:any) => setUserPassword(e.target.value)}
                    />
                    <Button onClick={deleteUserAccount} variant="danger" fullWidth>
                      <TrashIcon size={16} />
                      Delete Account
                    </Button>
                  </CardBody>
                </Card>
              </div>

              {/* LOGOUT */}
              <div data-reveal-item className="animate-fade-up">
                <Button onClick={logout} variant="secondary" fullWidth>
                  <LogOutIcon size={16} />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </PageShell>
    </div>
  );
};

export default Settings;
