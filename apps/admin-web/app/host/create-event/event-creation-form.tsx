"use client"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"
import { CalendarIcon, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import * as z from "zod"
import { createEvent } from "./actions"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export default function EventCreationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = useTranslations("pages.event-creation-form.EventCreationForm")

  const formSchema = z.object({
    title: z.string().min(2, {
      message: t("formSchema.title.errors.minLength")
    }),
    description: z.string().min(10, {
      message: t("formSchema.description.errors.minLength")
    }),
    date: z.date({
      required_error: t("formSchema.date.errors.required")
    }),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: t("formSchema.time.errors.required")
    }),
    location: z.string().min(2, {
      message: t("formSchema.location.errors.minLength")
    }),
    image: z
      .custom<FileList>()
      .refine(
        (files) => files.length === 0 || files.length === 1,
        t("formSchema.image.errors.required")
      )
      .refine(
        (files) => files.length === 0 || files[0].size <= MAX_FILE_SIZE,
        t("formSchema.image.errors.tooLarge")
      ),
    is_icypaa_event: z.boolean().default(false)
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      time: "",
      location: "",
      is_icypaa_event: false
    }
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    const formData = new FormData()
    Object.entries(values).forEach(([key, value]) => {
      if (key === "date") {
        formData.append(key, format(value as string, "yyyy-MM-dd"))
      } else if (key === "image") {
        if (value instanceof FileList && value.length > 0) {
          formData.append(key, value[0])
        }
      } else if (key === "is_icypaa_event") {
        formData.append(key, value ? "true" : "false")
      } else {
        formData.append(key, value as string)
      }
    })

    try {
      const result = (await createEvent(formData)) as any
      if (result.success) {
        toast.success(result.message || "Event created successfully")
        if (values.is_icypaa_event) {
          // Redirect to volunteer management page
          router.push(`/host/manage-volunteers?eventId=${result.eventId}`)
        } else {
          router.push("/events")
        }
        router.refresh()
      } else {
        // Handle error
        toast.error(result.message || "Failed to create event")
        console.error("Failed to create event:", result.message)
        form.setError("root", { type: "manual", message: result.message })
      }
    } catch (error) {
      console.error("Error creating event:", error)
      toast.error("An unexpected error occurred while creating the event")
      form.setError("root", {
        type: "manual",
        message: "An unexpected error occurred"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.title.label")}</FormLabel>
              <FormControl>
                <Input placeholder={t("form.title.placeholder")} {...field} />
              </FormControl>
              <FormDescription>{t("form.title.description")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.description.label")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("form.description.placeholder")}
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("form.description.description")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>{t("form.date.label")}</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>{t("form.date.placeholder")}</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) =>
                      date < new Date() || date > new Date("2025-08-31")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>{t("form.date.description")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.time.label")}</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormDescription>{t("form.time.description")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.location.label")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("form.location.placeholder")}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("form.location.description")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="image"
          render={({ field: { onChange, value, ...rest } }) => (
            <FormItem>
              <FormLabel>{t("form.image.label")}</FormLabel>
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onChange(e.target.files)}
                  {...rest}
                />
              </FormControl>
              <FormDescription>{t("form.image.description")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="is_icypaa_event"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t("form.is_icypaa_event.label")}</FormLabel>
                <FormDescription>
                  {t("form.is_icypaa_event.description")}
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("form.submit.loading")}
            </>
          ) : (
            t("form.submit.cta")
          )}
        </Button>
      </form>
    </Form>
  )
}
