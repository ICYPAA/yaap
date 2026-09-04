import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { ReactNode } from "react";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: AuthCardProps) {
  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader className="space-y-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo-512.png"
            alt="66th ICYPAA — On Awakening"
            width={56}
            height={56}
            className="rounded-lg"
            priority
          />
          <div>
            <p className="text-sm font-medium">On Awakening</p>
            <p className="text-sm text-muted-foreground">
              66th ICYPAA · Michigan
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">{eyebrow}</p>
          <CardTitle className="text-3xl font-bold">
            <h1>{title}</h1>
          </CardTitle>
          <CardDescription className="leading-6">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
