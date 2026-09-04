"use client";

import { useToast } from "@/components/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  normalizeProgramFeatures,
  PROGRAM_FEATURE_GROUPS,
  PROGRAM_FEATURE_KEYS,
  type ProgramFeatureFlags,
  type ProgramFeatureKey,
} from "@/lib/program-features";
import { Edit, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { updateProgramFeatures, type Program } from "./actions";

interface ProgramFeaturesCardProps {
  program: Program;
  onUpdated: (features: ProgramFeatureFlags) => void;
}

export function ProgramFeaturesCard({
  program,
  onUpdated,
}: ProgramFeaturesCardProps) {
  const { toast } = useToast();
  const savedFeatures = useMemo(
    () => normalizeProgramFeatures(program.features),
    [program.features],
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftFeatures, setDraftFeatures] =
    useState<ProgramFeatureFlags>(savedFeatures);

  const enabledCount = PROGRAM_FEATURE_KEYS.filter(
    (key) => savedFeatures[key],
  ).length;
  const changedCount = PROGRAM_FEATURE_KEYS.filter(
    (key) => draftFeatures[key] !== savedFeatures[key],
  ).length;

  useEffect(() => {
    const requestedSettings = new URLSearchParams(window.location.search).get(
      "settings",
    );
    if (requestedSettings === "features") {
      setDraftFeatures(savedFeatures);
      setOpen(true);
    }
    // The query parameter is only an initial navigation instruction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) return;
    if (nextOpen) setDraftFeatures(savedFeatures);
    setOpen(nextOpen);
  };

  const setFeature = (key: ProgramFeatureKey, enabled: boolean) => {
    setDraftFeatures((current) => ({ ...current, [key]: enabled }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateProgramFeatures(program.id, draftFeatures);

      if (result.error || !result.features) {
        toast({
          title: "App features were not updated",
          description: result.error || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      onUpdated(result.features);
      setOpen(false);
      toast({
        title: "App features updated",
        description: `Feature availability for ${program.title} has been saved.`,
      });
    } catch (error) {
      console.error("Error updating app features:", error);
      toast({
        title: "App features were not updated",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Settings2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            App Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {enabledCount} of {PROGRAM_FEATURE_KEYS.length} enabled
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="manage-app-features"
              aria-label="Manage App Features"
              onClick={() => handleOpenChange(true)}
            >
              <Edit className="mr-2 h-3 w-3" />
              Manage
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <DialogTitle>App features for {program.title}</DialogTitle>
              <Badge variant="secondary">{enabledCount} enabled</Badge>
            </div>
            <DialogDescription>
              Choose which attendee-facing tools are available for this
              conference. Saved changes are picked up when the app refreshes its
              conference settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {PROGRAM_FEATURE_GROUPS.map((group, groupIndex) => (
              <section key={group.title} className="space-y-3">
                {groupIndex > 0 ? <Separator /> : null}
                <div className={groupIndex > 0 ? "pt-3" : undefined}>
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                <div className="space-y-1">
                  {group.features.map((feature) => {
                    const controlId = `feature-${program.id}-${feature.key}`;

                    return (
                      <div
                        key={feature.key}
                        className="flex items-start justify-between gap-6 rounded-md px-3 py-3 hover:bg-muted/50"
                      >
                        <div className="space-y-1">
                          <Label htmlFor={controlId} className="cursor-pointer">
                            {feature.name}
                          </Label>
                          <p className="text-sm leading-5 text-muted-foreground">
                            {feature.description}
                          </p>
                        </div>
                        <Checkbox
                          id={controlId}
                          className="mt-0.5"
                          checked={draftFeatures[feature.key]}
                          disabled={saving}
                          onCheckedChange={(checked) =>
                            setFeature(feature.key, checked === true)
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || changedCount === 0}
              onClick={handleSave}
            >
              {saving
                ? "Saving…"
                : changedCount > 0
                  ? `Save ${changedCount} change${changedCount === 1 ? "" : "s"}`
                  : "No changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
