// 5x7 dot-matrix glyphs, same dot style as the globe.
const GLYPHS: Record<string, string[]> = {
    I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
    O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."],
    L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
    B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
    E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
};

function Word({ text }: { text: string }) {
    return (
        <span className="dot-word">
            {[...text].map((letter, index) => (
                <span className="dot-letter" key={index}>
                    {GLYPHS[letter].flatMap((row, y) =>
                        [...row].map((cell, x) => (
                            <i
                                key={`${x}-${y}`}
                                className={cell === "#" ? "on" : undefined}
                            />
                        ))
                    )}
                </span>
            ))}
        </span>
    );
}

export function DotWordmark() {
    return (
        <div className="dot-wordmark" role="img" aria-label="IOTA Globe">
            <Word text="IOTA" />
            <Word text="GLOBE" />
        </div>
    );
}
