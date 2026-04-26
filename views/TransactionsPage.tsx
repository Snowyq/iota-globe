"use client";

import { TransactionStreamItem } from "@/app/api/transactions/stream/route";
import { FormattedCell } from "@/components/FormattedCell";
import { LiveBadge } from "@/components/LiveBadge";
import { Page } from "@/components/Page";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useLiveStream } from "@/hooks/useLiveStream";
import { useNowTime } from "@/hooks/useNowTime";
import { useOnNetworkChange } from "@/hooks/useOnNetworkChange";
import { shortString, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useState } from "react";

const MAX_ITEMS = 100;

type Stored = TransactionStreamItem & { arrivedAt: number };

export default function TransactionsPage() {
    const [txs, setTxs] = useState<Stored[]>([]);
    const now = useNowTime();

    useOnNetworkChange(() => setTxs([]));

    useLiveStream<TransactionStreamItem>("/api/transactions/stream", (item) => {
        setTxs((prev) => {
            if (prev.some((t) => t.digest === item.digest)) return prev;
            return [{ ...item, arrivedAt: Date.now() }, ...prev].slice(0, MAX_ITEMS);
        });
    });

    const isLoading = txs.length === 0;

    return (
        <Page>
            <PageHeader
                title="Transactions"
                description="Live feed from latest checkpoints"
                action={<LiveBadge ttl={2_000} />}
            />

            <Table className="w-full">
                <TableCaption>Live IOTA transactions.</TableCaption>
                <TableHeader>
                    <TableRow className="hover:bg-transparent!">
                        <TableCell className="text-xs text-muted-foreground">
                            Digest
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                            Sender
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                            Txns
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                            Gas
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                            Time
                        </TableCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading
                        ? Array.from({ length: 12 }).map((_, i) => (
                              <TableRow key={i}>
                                  <TableCell>
                                      <Skeleton className="h-3 w-28" />
                                  </TableCell>
                                  <TableCell>
                                      <Skeleton className="h-3 w-32" />
                                  </TableCell>
                                  <TableCell>
                                      <Skeleton className="ml-auto h-3 w-8" />
                                  </TableCell>
                                  <TableCell>
                                      <Skeleton className="ml-auto h-3 w-16" />
                                  </TableCell>
                                  <TableCell>
                                      <Skeleton className="ml-auto h-3 w-10" />
                                  </TableCell>
                              </TableRow>
                          ))
                        : txs.map((tx, i) => (
                              <TableRow
                                  key={tx.digest}
                                  className={cn(
                                      "text-xs",
                                      i === 0 && "bg-primary/5"
                                  )}
                              >
                                  <TableCell className="font-mono">
                                      {shortString(tx.digest, 10, 0)}
                                  </TableCell>
                                  <TableCell>
                                      {tx.isSystem ? (
                                          <span className="text-muted-foreground italic">
                                              IOTA System
                                          </span>
                                      ) : (
                                          <span className="font-mono">
                                              {shortString(tx.sender)}
                                          </span>
                                      )}
                                  </TableCell>
                                  <FormattedCell
                                      value={tx.txnsCount}
                                      label="txns"
                                      align="center"
                                  />
                                  <FormattedCell
                                      value={
                                          tx.gasIOTA > 0
                                              ? tx.gasIOTA.toFixed(4)
                                              : null
                                      }
                                      label="IOTA"
                                      align="right"
                                  />
                                  <FormattedCell
                                      value={timeAgo(tx.arrivedAt, now)}
                                      align="right"
                                      className="min-w-20"
                                  />
                              </TableRow>
                          ))}
                </TableBody>
            </Table>
        </Page>
    );
}
