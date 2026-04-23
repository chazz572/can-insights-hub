import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface AnalysisCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  icon?: ReactNode;
}

export const AnalysisCard = ({ title, description, children, icon }: AnalysisCardProps) => (
  <Card className="animate-fade-up overflow-hidden">
    <CardHeader className="min-w-0 p-4 sm:p-6">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {icon ? <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow backdrop-blur">{icon}</div> : null}
      </div>
    </CardHeader>
    <CardContent className="min-w-0 p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
  </Card>
);
