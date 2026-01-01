import { useEffect, useState } from "react";
import { checkUserReviewAvailability, sendFeedbackReview } from "../apis/reviews";

const Reviews = () => {
  const [step, setStep] = useState(1);
  const [stars, setStars] = useState(0);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [serverError, setServerError] = useState("");

  const [hasSentCSS,setHasSentCSS] = useState("flex visible")

  //check if already sent.
  useEffect(()=>{
    const checkIfAlreadySent = async()=>{
        try{
            const res = await checkUserReviewAvailability();
            if(!res || res.Success==false){
                setHasSentCSS("hidden invisible ")
                return;
            }

            setHasSentCSS("flex visible")

        }catch{
            setHasSentCSS("hidden invisible")
        }
    }

    checkIfAlreadySent()
  },[])

  const sendFeedback = async () => {
    if (stars === 0) {
      setServerError("Please select a rating.");
      return;
    }

    try {
      setServerError("");

      const payload = {
        stars,
        comment,
      };

      const res= await sendFeedbackReview(payload)
    //   console.log(res)
      if(!res){
        setServerError("Something went wrong.")
        return;
      }

      if(res.Success==false){
        setServerError(res.Message)
        return;
      }

      setStep(3); // success step
    } catch (error) {
      setServerError("Something went wrong. Please try again.");
    }
  };

  return (
    <main className={`w-full md:w-[700px] p-[10px] flex-col items-center rounded-[10px] bg-[#353535] shadow-xl border border-[#FF7B22] ${hasSentCSS}`}>
      
      {/* Title */}
      <section className="w-full p-[10px] flex justify-center">
        <h1 className="text-[#FF7B22] text-2xl font-medium">Feedback</h1>
      </section>

      {/* STEP 1 — STARS */}
      {step === 1 && (
        <section className="w-full p-[10px] flex flex-col items-center gap-4">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverStars(star)}
                onMouseLeave={() => setHoverStars(0)}
                onClick={() => {
                  setStars(star);
                  setServerError("");
                }}
                className="text-3xl transition-transform hover:scale-125"
              >
                <span
                  className={
                    star <= (hoverStars || stars)
                      ? "text-[#FF7B22]"
                      : "text-gray-500"
                  }
                >
                  ★
                </span>
              </button>
            ))}
          </div>

          {stars > 0 && (
            <p className="text-sm text-gray-300">
              {["Terrible", "Bad", "Okay", "Good", "Excellent"][stars - 1]}
            </p>
          )}

          {serverError && (
            <p className="text-red-400 text-sm">{serverError}</p>
          )}

          <button
            onClick={() => {
              if (stars > 0) {
                setStep(2);
                setServerError("");
              } else {
                setServerError("Stars must be more than 0.");
              }
            }}
            className="px-4 py-2 rounded-lg bg-[#FF7B22] text-black font-medium hover:scale-105 transition"
          >
            Next
          </button>
        </section>
      )}

      {/* STEP 2 — COMMENT */}
      {step === 2 && (
        <section className="w-full p-[10px] flex flex-col gap-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write your feedback (optional)"
            maxLength={300}
            className="w-full h-[120px] resize-none p-3 rounded-lg bg-[#2a2a2a] text-white border border-gray-600 focus:outline-none focus:border-[#FF7B22]"
          />

          <p className="self-end text-xs text-gray-400">
            {comment.length}/300
          </p>

          {serverError && (
            <p className="text-red-400 text-sm">{serverError}</p>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg border border-gray-500 text-white hover:bg-gray-600"
            >
              Back
            </button>

            <button
              onClick={sendFeedback}
              className="px-6 py-2 rounded-lg bg-[#FF7B22] text-black font-medium hover:scale-105 transition"
            >
              Send
            </button>
          </div>
        </section>
      )}

      {/* STEP 3 — SUCCESS */}
      {step === 3 && (
        <section className="w-full p-[20px] flex flex-col items-center gap-3">
          <p className="text-xl text-[#FF7B22]">Thank you! 🎉</p>
          <p className="text-gray-300 text-sm">
            Your feedback helps us improve.
          </p>
        </section>
      )}
    </main>
  );
};

export default Reviews;
