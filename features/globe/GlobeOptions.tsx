import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Brush, Fullscreen, Globe, Map, Settings } from "lucide-react";

export function GlobeOptions({ className }: { className?: string }) {
    return (
        <div className={cn("flex gap-2", className)}>
            <Button variant="secondary" size="icon">
                <Fullscreen />
            </Button>
            <Button variant="secondary" size="icon">
                <Globe />
            </Button>
            <Button variant="secondary" size="icon">
                <Settings />
            </Button>
            <Button variant="secondary" size="icon">
                <Map />
            </Button>
            <Button variant="secondary" size="icon">
                <Brush />
            </Button>
        </div>
    );
}
