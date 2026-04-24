"use client";

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useContext } from "react";
import { ValidatorsContext } from "./ValidatorsContext";

export default function ValidatorsTable({ query }: { query: string }) {
    const { validators } = useContext(ValidatorsContext);

    const filteredValidators = validators.filter((validator) =>
        validator.payload.name.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <Table className="relative w-full">
            <TableCaption>A list of your recent invoices.</TableCaption>
            <TableHeader>
                <TableRow className="w-full text-xs">
                    <TableCell>Validator</TableCell>
                    <TableCell>Stake</TableCell>
                    <TableCell>APY</TableCell>
                    <TableCell>Voting Power</TableCell>
                    <TableCell>Last Epoch Reward</TableCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {filteredValidators.map((validator) => (
                    <TableRow
                        key={validator.payload.netAddress}
                        className="cursor-pointer transition-colors"
                    >
                        <TableCell className="flex items-center gap-2 font-medium">
                            {validator.payload.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={validator.payload.imageUrl}
                                    alt={validator.payload.name}
                                    className="h-8 w-8 object-contain"
                                    width={20}
                                    height={20}
                                />
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-200">
                                    {validator.payload.name.slice(0, 1)}
                                </div>
                            )}
                            <span className="text-xs">
                                {validator.payload.name}
                            </span>
                        </TableCell>
                        {/* <TableCell className="font-medium">
                            {validator.stakeIOTA.toFixed(2)}
                            <span> M</span>
                            <span className="text-[10px] text-muted-foreground">
                                {" "}
                                IOTA
                            </span>
                        </TableCell>
                        <TableCell className="font-medium">
                            {validator.apyPercent !== null
                                ? `${validator.apyPercent.toFixed(2)}%`
                                : "N/A"}
                        </TableCell>
                        <TableCell className="font-medium">
                            {validator.stakePercent}%
                        </TableCell>
                        <TableCell className="font-medium">
                            {validator.lastEpochRewardIOTA !== null
                                ? validator.lastEpochRewardIOTA.toFixed(2)
                                : "N/A"}{" "}
                            <span> K</span>
                            <span className="text-[10px] text-muted-foreground">
                                {" "}
                                IOTA
                            </span>
                        </TableCell> */}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
