export function GlobeSkeleton() {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-[#08070e]">
            <div className="relative flex items-center justify-center">
                {/* outer glow ring */}
                <div className="absolute h-[420px] w-[420px] animate-pulse rounded-full bg-[#6067F9]/5 sm:h-[560px] sm:w-[560px]" />
                {/* mid ring */}
                <div className="absolute h-[360px] w-[360px] animate-pulse rounded-full bg-[#6067F9]/8 [animation-delay:150ms] sm:h-[480px] sm:w-[480px]" />
                {/* globe circle */}
                <div className="relative h-[300px] w-[300px] overflow-hidden rounded-full bg-[#1a0a3d] sm:h-[400px] sm:w-[400px]">
                    {/* continent shimmer blobs */}
                    <div className="absolute top-[20%] left-[15%] h-[18%] w-[25%] animate-pulse rounded-[40%] bg-[#6067F9]/20 [animation-delay:100ms]" />
                    <div className="absolute top-[25%] left-[45%] h-[22%] w-[20%] animate-pulse rounded-[40%] bg-[#6067F9]/20 [animation-delay:250ms]" />
                    <div className="absolute top-[50%] left-[20%] h-[20%] w-[28%] animate-pulse rounded-[40%] bg-[#6067F9]/15 [animation-delay:400ms]" />
                    <div className="absolute top-[45%] left-[55%] h-[18%] w-[22%] animate-pulse rounded-[40%] bg-[#6067F9]/15 [animation-delay:550ms]" />
                    <div className="absolute top-[70%] left-[35%] h-[14%] w-[18%] animate-pulse rounded-[40%] bg-[#6067F9]/10 [animation-delay:700ms]" />
                    {/* atmosphere overlay */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-[#5784a7]/10" />
                </div>
            </div>
        </div>
    );
}
