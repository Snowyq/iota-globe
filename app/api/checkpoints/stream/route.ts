import {
    subscribeCheckpoints,
    type CheckpointStreamItem,
} from "@/lib/checkpointHub";
import { hubRoute } from "@/lib/hubStream";

export type { CheckpointStreamItem };

// Starts with the last minute already read, then each checkpoint as it lands.
export const GET = hubRoute(subscribeCheckpoints);
