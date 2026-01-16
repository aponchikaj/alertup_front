import { useEffect, useState, type JSX } from "react";
import { ConnectApis } from "../../apis/connect";
import { MAIN_API_URL } from "../../apis/APIS";

const ServerGate = ({ children }: { children: JSX.Element }) => {
  const [loading, setLoading] = useState(true);
  const [serverDown, setServerDown] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  useEffect(() => {
    const connect = async (attempt: number = 0) => {
      try {
        const res = await ConnectApis();

        if (res?.Success !== true) {
          if (attempt < MAX_RETRIES) {
            // Retry after delay
            setTimeout(() => {
              setRetryCount(attempt + 1);
              connect(attempt + 1);
            }, RETRY_DELAY);
            return;
          }
          setErrorMessage(res?.Message || "Server connection failed");
          setServerDown(true);
          setLoading(false);
          return;
        }
        
        // Success - server is available
        setLoading(false);
        setServerDown(false);
      } catch (err: any) {
        console.error("ServerGate error:", err);
        
        if (attempt < MAX_RETRIES) {
          // Retry after delay
          setTimeout(() => {
            setRetryCount(attempt + 1);
            connect(attempt + 1);
          }, RETRY_DELAY);
          return;
        }
        
        setErrorMessage(err?.message || "Failed to connect to server");
        setServerDown(true);
        setLoading(false);
      }
    };

    connect();
  }, []);

  if (loading) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-[#353535] text-white">
        <div className="text-center">
          <h1 className="text-3xl mb-4">Alert<span className="text-[#FF7B22]">up</span></h1>
          <p className="mb-2">Connecting to server…</p>
          {retryCount > 0 && (
            <p className="text-sm opacity-60">Retry attempt {retryCount}/{MAX_RETRIES}</p>
          )}
          <p className="text-sm opacity-80 mt-4">Hosted on free service</p>
        </div>
      </main>
    );
  }

  if (serverDown) {
    return (
      <main className="w-full h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl mb-4">Server is currently unavailable</h1>
          {errorMessage && (
            <p className="text-red-400 mb-4 text-sm">{errorMessage}</p>
          )}
          <p className="text-sm opacity-70 mb-4">
            Please check:
          </p>
          <ul className="text-left text-sm opacity-60 mb-6 space-y-2">
            <li>• Backend server is running</li>
            <li>• API URL is correct: {MAIN_API_URL}</li>
            <li>• CORS is properly configured</li>
            <li>• Network connection is active</li>
          </ul>
          <button
            onClick={() => {
              setLoading(true);
              setServerDown(false);
              setRetryCount(0);
              window.location.reload();
            }}
            className="px-6 py-2 bg-[#FF7B22] rounded-lg hover:bg-[#FF8B33] transition"
          >
            Retry Connection
          </button>
        </div>
      </main>
    );
  }

  return children;
};

export default ServerGate;
