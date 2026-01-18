import { useEffect, useState } from "react";
import { createNewBuilding } from "../../apis/building";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../apis/me";

interface BuildingSchema {
  buildingName: string;
  floors: number;
  floorNames: string[];
  maps: File[];
}

const NewBuilding = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  // const [isUserVerified,setIsUserVerified] = useState(null)

  const [buildingData, setBuildingData] = useState<BuildingSchema>({
    buildingName: "",
    floors: 1,
    floorNames: [],
    maps: [],
  });

  const checkVerification = async()=>{
    const res = await getMe()
    console.log(res)
    if(!res || res.Success==false) navigate('/login')
    if(res.Message.verified == false) navigate('/settings')
  }

  /* ----------------------------------
     PAGE SETUP - NO PREMIUM RESTRICTIONS
  ----------------------------------- */
  useEffect(() => {
    document.title = "New - Alertup";
    checkVerification()
    // No premium checks - unlimited access for all users
  }, []);

  /* ----------------------------------
     KEEP FLOORS / ARRAYS IN SYNC
  ----------------------------------- */
  useEffect(() => {
    setBuildingData((prev) => ({
      ...prev,
      floorNames: prev.floorNames.slice(0, prev.floors),
      maps: prev.maps.slice(0, prev.floors),
    }));
  }, [buildingData.floors]);

  /* ----------------------------------
     FILE HANDLER
  ----------------------------------- */
  const handleFileChange = (index: number, file: File) => {
    const newMaps = [...buildingData.maps];
    newMaps[index] = file;
    setBuildingData({ ...buildingData, maps: newMaps });
  };

  /* ----------------------------------
     STEP CONTROL
  ----------------------------------- */
  const goNext = () => {
    if (!buildingData.buildingName.trim()) {
      setServerError("Building name is required.");
      return;
    }
    setServerError("");
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
  };

  /* ----------------------------------
     SUBMIT
  ----------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    setLoading(true);

    try {
        const formData = new FormData();
        formData.append("buildingName", buildingData.buildingName);
        formData.append("floors", buildingData.floors.toString());

        buildingData.floorNames.forEach((name) => {
        formData.append("floorNames[]", name); // must append each floor name
        });

        buildingData.maps.forEach((file) => {
        if (file) formData.append("maps", file); // append each map file
        });

        const res = await createNewBuilding(formData); // axios must send FormData
        if (!res || res.Success === false) {
        setServerError(res?.Message || "Something went wrong.");
        setLoading(false);
        return;
        }

        navigate("/mybuildings");
    } catch (err) {
        setServerError("Couldn't create new building.");
        setLoading(false);
    }
    };


  /* ----------------------------------
     FLOOR INPUTS
  ----------------------------------- */
  const renderFloorInputs = () => {
    return Array.from({ length: buildingData.floors }).map((_, i) => (
      <div key={i} className="mb-4">
        <label className="text-white block mb-1">
          Floor {i + 1} Name
        </label>
        <input
          type="text"
          className="w-full px-4 py-2 rounded-lg bg-black/40 text-white outline-none"
          value={buildingData.floorNames[i] || ""}
          onChange={(e) => {
            const names = [...buildingData.floorNames];
            names[i] = e.target.value;
            setBuildingData({ ...buildingData, floorNames: names });
          }}
          required
        />

        <label className="text-white block mb-1 mt-2">
          Floor {i + 1} Map
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileChange(i, e.target.files[0]);
            }
          }}
          required
        />
      </div>
    ));
  };

  /* ----------------------------------
     RENDER
  ----------------------------------- */
  return (
    <main className="w-full min-h-screen flex items-center justify-center bg-[#353535] p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white/5 backdrop-blur-lg rounded-2xl p-6 md:p-8 shadow-xl border border-white/10"
      >
        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Create Building
        </h1>

        <p className="text-sm text-white/60 text-center mb-4">
          Unlimited floors available
        </p>

        {serverError && (
          <p className="text-red-500 text-center mb-4">{serverError}</p>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <>
            <label className="text-white block mb-1">Building Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 rounded-lg bg-black/40 text-white outline-none mb-3"
              value={buildingData.buildingName}
              onChange={(e) =>
                setBuildingData({
                  ...buildingData,
                  buildingName: e.target.value,
                })
              }
              required
            />

            <label className="text-white block mb-1">Number of Floors</label>
            <input
              type="number"
              min={1}
              className="w-full px-4 py-2 rounded-lg bg-black/40 text-white outline-none mb-3"
              value={buildingData.floors}
              onChange={(e) => {
                const value = Number(e.target.value);
                setBuildingData({
                  ...buildingData,
                  floors: Math.max(1, value),
                });
              }}
              required
            />

            <button
              type="button"
              onClick={goNext}
              className="w-full py-2 mt-4 rounded-lg bg-[#FF7B22] text-white font-semibold hover:scale-105 transition"
            >
              Next
            </button>
          </>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <>
            {renderFloorInputs()}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={goBack}
                className="w-1/2 py-2 rounded-lg bg-white/20 text-white hover:scale-105 transition"
              >
                Back
              </button>

              <button
                type="submit"
                disabled={loading}
                className={`w-1/2 py-2 rounded-lg bg-[#FF7B22] text-white font-semibold ${
                  loading
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:scale-105 transition"
                }`}
              >
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </>
        )}
      </form>
    </main>
  );
};

export default NewBuilding;
