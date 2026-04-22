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
    <CardHeader>
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {icon ? <div className="grid size-11 shrink-0 place-items-center rounded-lg border border-glass-border bg-glass text-primary shadow-glow backdrop-blur">{icon}</div> : null}
      </div>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
