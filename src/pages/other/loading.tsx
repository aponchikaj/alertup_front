import { useEffect, useState, type JSX } from "react";
import { ConnectApis } from "../../apis/connect";

const ServerGate = ({ children }: { children: JSX.Element }) => {
  const [loading, setLoading] = useState(true);
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    const connect = async () => {
      try {
        const res = await ConnectApis();

        if (res?.Success !== true) {
          setServerDown(true);
        }
      } catch (err) {
        console.error("ServerGate error:", err);
        setServerDown(true);
      } finally {
        setLoading(false);
      }
    };

    connect();
  }, []);

  if (loading) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-[#353535] text-white">
        <div className="text-center">
          <h1 className="text-3xl">Alert<span className="text-[#FF7B22]">up</span></h1>
          <p>Server is loading…</p>
          <p className="text-sm opacity-80">Hosted on free service</p>
        </div>
      </main>
    );
  }

  if (serverDown) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-black text-white">
        <p>Server is currently unavailable.</p>
      </main>
    );
  }

  return children;
};

export default ServerGate;
