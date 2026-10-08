import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "paisaxe";
import { Share2 } from "lucide-react";

export const Open = () => (
  <div className="flex items-center justify-center p-12" style={{ width: 320, height: 180 }}>
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger asChild>
          <Button variant="glassIcon" aria-label="Compartir">
            <Share2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Compartir esta historia</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
);
