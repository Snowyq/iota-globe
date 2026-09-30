import { describe, expect, it } from "vitest";
import {
    formatNumber,
    formatIota,
    formatNanoToIota,
    formatDuration,
    formatTimestamp,
    timeAgo,
    shortString,
    formatApy,
    formatCommissionRate,
} from "@/lib/format";

describe("format", () => {
    it.each([
        [0, "0", ""],
        [999, "999", ""],
        [1000, "1.0", "K"],
        [1_000_000, "1.00", "M"],
        [1_000_000_000, "1.00", "B"],
    ])("formats %s with a unit suffix", (input, value, label) => {
        expect(formatNumber(input)).toMatchObject({ value, label });
    });

    it("shows a dash for missing values", () => {
        for (const input of [null, undefined, NaN])
            expect(formatNumber(input).value).toBe("—");
        expect(formatNanoToIota(null).value).toBe("—");
        expect(formatApy(null).value).toBe("—");
        expect(formatCommissionRate(null).value).toBe("—");
    });

    it("converts nanos to IOTA", () => {
        expect(formatNanoToIota("1250000000")).toEqual({
            value: "1.25",
            label: "IOTA",
            raw: 1.25,
        });
        expect(formatNanoToIota("0")).toMatchObject({ value: "0.00" });
        expect(formatNanoToIota("-2500000000")).toMatchObject({
            value: "-2.50",
            raw: -2.5,
        });
        expect(formatIota(1200, false, 3)).toMatchObject({
            value: "1.200",
            label: "K",
        });
    });

    it("formats APY and commission rates", () => {
        expect(formatApy(5.25)).toMatchObject({ value: "5.25", label: "%" });
        expect(formatApy(0).value).toBe("0.00");
        // Commission is in basis points.
        expect(formatCommissionRate(250)).toMatchObject({
            value: "2.50",
            raw: 2.5,
        });
    });

    it.each([
        [null, "—"],
        [-1000, "0s"],
        [61_000, "1m 1s"],
        [3_661_000, "1h 1m 1s"],
        [90_061_000, "1d 1h 1m"],
    ])("formats duration %s", (duration, expected) => {
        expect(formatDuration(duration)).toBe(expected);
    });

    it("formats relative time", () => {
        expect(timeAgo(11000, 10000)).toMatchObject({
            value: "0",
            label: "s ago",
        });
        expect(timeAgo(0, 60000)).toMatchObject({ value: "1", label: "m ago" });
        expect(timeAgo(0, 3600000)).toMatchObject({
            value: "1",
            label: "h ago",
        });
        expect(timeAgo(null, 10000).value).toBe("—");
    });

    it("formats timestamps in UTC", () => {
        expect(formatTimestamp(0, "long")).toBe("01.01.1970 00:00:00");
        expect(formatTimestamp(0)).toBe("01.01.1970");
        expect(formatTimestamp("")).toBe("—");
    });

    it("shortens long strings", () => {
        expect(shortString("Alpha", 10)).toBe("Alpha");
        expect(shortString("0x123456789abcdef", 4, 4)).toBe("0x12...cdef");
        expect(shortString("abcdef", 4, 4)).toBe("abcdef");
    });
});
