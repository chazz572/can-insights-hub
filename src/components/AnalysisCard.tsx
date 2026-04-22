import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface AnalysisCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export const AnalysisCard = ({ title, description, children }: AnalysisCardProps) => (
  <Card className="animate-fade-up bg-gradient-panel shadow-dashboard">
    <CardHeader>
      <CardTitle className="text-xl">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);