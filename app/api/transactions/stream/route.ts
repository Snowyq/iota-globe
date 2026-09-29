import { hubRoute } from "@/lib/hubStream";
import {
    subscribeTransactions,
    type TransactionStreamItem,
} from "@/lib/transactionHub";

export type { TransactionStreamItem };

export const GET = hubRoute(subscribeTransactions);
