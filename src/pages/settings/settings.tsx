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
import { useNavigate } from "react-router-dom";

const Settings = () => {
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

  useEffect(() => {
    document.title = "Settings - AlertUp";
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
        setNewEmailStep(2)
      } else if(newEmailStep === 2 ) {
        setNewEmail("")
        res = await verifyNewEmailCode({ newEmail, userCode: newEmailCode });
        setNewEmailCode("")
      }

      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        setNewEmail("")
        return;
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
        setAccountVerificationCodeStep(2)
      } else if(accountVerificationCodeStep === 2) {
        res = await verifyAccountCode({ userCode: accountVerificationCode });
        setAccountVerificationCode("")
      }

      if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
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
      setServerError("Logged out successfully!");
    } catch {
      setServerError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen bg-[#353535] text-white flex flex-col items-center py-10 px-4">
      <div className="w-full h-[10vh]" />
      <div className="w-full max-w-6xl space-y-8">

        <h1 className="text-3xl font-bold text-center mb-6">User Settings</h1>

        {loading && <p className="text-[#FF7B22] animate-pulse text-center">Loading...</p>}
        {serverError && <p className="text-white text-center">{serverError}</p>}

        {userData && (
          <>
            {/* USER INFO */}
            <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-2xl font-bold mb-4">Profile Info</h2>

              <InputField
                label="Username"
                value={userData.username}
                onChange={(e:any) => setUserData({ ...userData, username: e.target.value })}
              />
              <InputField
                label="Phone"
                value={userData.phone}
                onChange={(e:any) => setUserData({ ...userData, phone: e.target.value })}
              />
              <InputField
                label="Country"
                value={userData.country}
                onChange={(e:any) => setUserData({ ...userData, country: e.target.value })}
              />

              <button
                onClick={saveUserSettings}
                className="w-full bg-[#FF7B22] hover:bg-[#e06b1b] transition text-black font-semibold py-2 rounded-xl"
              >
                Save Profile
              </button>
            </section>

            {/* CHANGE PASSWORD */}
            <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-2xl font-bold mb-4">Change Password</h2>
              <InputField
                label="Old Password"
                type="password"
                value={oldPassword}
                onChange={(e:any) => setOldPassword(e.target.value)}
              />
              <InputField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e:any) => setNewPassword(e.target.value)}
              />
              <button
                onClick={changePassword}
                className="w-full bg-[#FF7B22] hover:bg-[#e06b1b] transition text-black font-semibold py-2 rounded-xl"
              >
                Change Password
              </button>
            </section>

            {/* EMAIL CHANGE */}
            <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-2xl font-bold mb-4">Change Email</h2>
              {newEmailStep === 1 && (
                <InputField
                  label="New Email"
                  value={newEmail}
                  type={"email"}
                  onChange={(e:any) => setNewEmail(e.target.value)}
                />
              )}
              {newEmailStep === 2 && (
                <InputField
                  label="Verification Code"
                  value={newEmailCode}    
                  type={"number"}
                  onChange={(e:any) => setNewEmailCode(e.target.value)}
                />
              )}
              <button
                onClick={NewEmail}
                className="w-full bg-[#FF7B22] hover:bg-[#e06b1b] transition text-black font-semibold py-2 rounded-xl"
              >
                {newEmailStep === 1 ? "Send Verification Code" : "Verify Email"}
              </button>
            </section>

            {/* ACCOUNT VERIFICATION */}
              {
                userData.verified == false ?
                <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
                  <h2 className="text-2xl font-bold mb-4">Verify Account</h2>
                  {accountVerificationCodeStep === 2 && (
                    <InputField
                      label="Verification Code"
                      value={accountVerificationCode}
                      onChange={(e:any) => setAccountVerificationCode(e.target.value)}
                    />
                  )}
                  <button
                    onClick={verifyAccount}
                    className="w-full bg-[#FF7B22] hover:bg-[#e06b1b] transition text-black font-semibold py-2 rounded-xl"
                  >
                    {accountVerificationCodeStep === 1 ? "Send Code" : "Verify Account"}
                  </button>
                </section>
                : null
              }

            {/* DELETE ACCOUNT */}
            <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-2xl font-bold mb-4 text-red-500">Delete Account</h2>
              <InputField
                label="Password"
                type="password"
                value={userPassword}
                onChange={(e:any) => setUserPassword(e.target.value)}
              />
              <button
                onClick={deleteUserAccount}
                className="w-full bg-red-600 hover:bg-red-700 transition text-white font-semibold py-2 rounded-xl"
              >
                Delete Account
              </button>
            </section>

            {/* LOGOUT */}
            <section className="flex justify-center mt-4">
              <button
                onClick={logout}
                className="bg-white/10 hover:bg-white/20 transition text-white font-semibold py-2 px-6 rounded-xl"
              >
                Logout
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const InputField = ({ label, type = "text", value, onChange }: any) => (
  <div className="flex flex-col space-y-1">
    <label className="text-white/70 font-medium">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="bg-black/20 border border-white/10 rounded-xl p-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FF7B22]"
    />
  </div>
);

export default Settings;
