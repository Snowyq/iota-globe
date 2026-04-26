export function GlobeSkeleton() {
    return (
        <div
            className="absolute top-[30vh] left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-radial from-primary/20 to-transparent md:top-1/3"
            style={{ width: "min(50rem, 55vh)", height: "min(50rem,55vh)" }}
        />
    );
}
