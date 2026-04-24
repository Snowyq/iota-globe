"use client";

import { Badge } from "@/components/ui/badge";
import { ValidatorsContext } from "@/features/iota/ValidatorsContext";
import { useContext } from "react";

export type ValidatorCluster = {
    count: number;
    validators: string[];
};

export function ClusterMarker({ cluster }: { cluster: ValidatorCluster }) {
    const { validators, selectValidator } = useContext(ValidatorsContext);

    const clusterValidators = validators.filter((v) =>
        cluster.validators.includes(v.iotaAddress)
    );

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (cluster.count === 1) {
            selectValidator?.(cluster.validators[0]);
        }
    };

    const isSingle = cluster.count === 1;

    if (isSingle && !clusterValidators[0]) return null;

    return (
        <Badge
            variant={"secondary"}
            className="relative cursor-pointer items-center justify-center bg-card/50! px-2 backdrop-blur-md"
            onClick={handleClick}
        >
            {isSingle ? (
                <>
                    <img
                        src={clusterValidators[0].payload.imageUrl}
                        alt={clusterValidators[0].payload.name}
                        className="aspect-square h-full object-contain"
                        width={20}
                        height={20}
                    />
                    <span className="text-muted-foreground">
                        {clusterValidators[0].payload.name
                            .slice(0, 3)
                            .toUpperCase()}
                    </span>
                </>
            ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    {cluster.count}
                </div>
            )}
        </Badge>
    );
}
