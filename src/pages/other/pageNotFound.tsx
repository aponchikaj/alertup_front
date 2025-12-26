import { useEffect } from "react";
import { Link } from "react-router-dom";

const PageNotFound = () => {
  useEffect(() => {
        document.title = "404 - AlertUp";
    }, []);
  return (
    <main className="w-full h-screen flex items-center justify-center bg-[#353535] text-white px-4">
      
      <section className="flex flex-col items-center text-center gap-4">
        
        {/* Big 404 */}
        <h1 className="text-[6rem] md:text-[8rem] font-extrabold text-[#FF7B22] leading-none">
          404
        </h1>

        {/* Title */}
        <h2 className="text-2xl md:text-4xl font-semibold">
          Page Not Found
        </h2>

        {/* Subtitle */}
        <p className="text-sm md:text-lg text-gray-300 max-w-md">
          The page you’re looking for doesn’t exist or was moved.
        </p>

        {/* Button */}
        <Link
          to="/"
          className="mt-4 px-6 py-2 rounded-full border-2 border-[#FF7B22] text-[#FF7B22] 
                     hover:bg-[#FF7B22] hover:text-[#353535] transition-all duration-300 
                     hover:scale-105 active:scale-95"
        >
          Go back home
        </Link>

      </section>

    </main>
  );
};

export default PageNotFound;
