import { GlobeNoSSR } from "@/features/globe/GlobeNoSSR";
import { GlobeOptions } from "@/features/globe/GlobeOptions";
import { ValidatorsView } from "@/features/iota/ValidatorsView";

export default function Index() {
    return (
        <div className="min-h-svh overflow-x-hidden">
            <div className="relative h-[80vh] max-h-[800px] w-screen">
                <div className="absolute inset-0 overflow-hidden">
                    <GlobeNoSSR className="" variant="home" />
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--nav-height)+2rem)] flex justify-center">
                    <div className="relative w-full max-w-6xl">
                        <GlobeOptions className="pointer-events-auto absolute right-4 flex-col sm:right-5 xl:right-10" />
                    </div>
                </div>
            </div>
            <div className="relative z-10 section -mt-20 w-full pt-px">
                <ValidatorsView />
            </div>
        </div>
    );
}
