import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_KEY = Deno.env.get("SERVICE_ROLE_KEY")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function getDriveTime(origin: string, destination: string): Promise<number | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${GOOGLE_MAPS_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    const element = data.rows?.[0]?.elements?.[0]
    if (element?.status === "OK") {
      return Math.round(element.duration.value / 60)
    }
    return null
  } catch {
    return null
  }
}

const TIME_SLOTS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30",
  "16:00","16:30"
]

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function isSlotAvailable(slot: string, appointments: any[]): boolean {
  const slotMins = timeToMinutes(slot)
  for (const apt of appointments) {
    const startMins = timeToMinutes(apt.start_time)
    const endMins = apt.end_time ? timeToMinutes(apt.end_time) : startMins + 60
    if (slotMins >= startMins && slotMins <= endMins) return false
  }
  return true
}

function getFirstSlotAfterAppointments(appointments: any[]): string | null {
  if (!appointments.length) return null
  const lastEnd = appointments
    .map(a => a.end_time || a.start_time)
    .sort()
    .pop()
  const lastEndMins = timeToMinutes(lastEnd)
  return TIME_SLOTS.find(s => timeToMinutes(s) >= lastEndMins) || null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { property_postcode, property_road, property_town, date_range_start, date_range_end } = await req.json()
    const newPropertyAddress = [property_road, property_town, property_postcode].filter(Boolean).join(", ")

    if (!newPropertyAddress) {
      return new Response(
        JSON.stringify({ error: "No property address provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, assigned_to, date, start_time, end_time, lead_id")
      .gte("date", date_range_start)
      .lte("date", date_range_end)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })

    const leadIds = [...new Set((appointments || []).map((a: any) => a.lead_id).filter(Boolean))]
    let leadAddresses: Record<number, string> = {}
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, property_road, property_town, property_postcode")
        .in("id", leadIds)
      for (const lead of leads || []) {
        leadAddresses[lead.id] = [lead.property_road, lead.property_town, lead.property_postcode].filter(Boolean).join(", ")
      }
    }

    const { data: surveyors } = await supabase
      .from("users")
      .select("id, full_name, home_postcode")
      .eq("active", true)
      .eq("is_surveyor", true)
      .not("home_postcode", "is", null)

    const { data: availabilityRules } = await supabase
      .from("surveyor_availability")
      .select("user_id, day_of_week, availability")

    const aptsByKey: Record<string, any[]> = {}
    for (const apt of appointments || []) {
      const key = `${apt.assigned_to}_${apt.date}`
      if (!aptsByKey[key]) aptsByKey[key] = []
      aptsByKey[key].push(apt)
    }

    const dates: string[] = []
    const start = new Date(date_range_start)
    const end = new Date(date_range_end)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0])
    }

    const now = new Date()
    const todayStr = now.toISOString().split("T")[0]
    const currentMinutes = now.getHours() * 60 + now.getMinutes() + 30

    const recommendations: any[] = []
    const allSlots: any[] = []

    for (const surveyor of surveyors || []) {
      for (const date of dates) {
        const dateObj = new Date(date)
        const dayOfWeek = dateObj.getDay()

        const rule = (availabilityRules || []).find(
          (r: any) => r.user_id === surveyor.id && r.day_of_week === dayOfWeek
        )
        const availability = rule?.availability || "full"

        if (availability === "unavailable") continue

        let allowedSlots = TIME_SLOTS
        if (availability === "morning") {
          allowedSlots = TIME_SLOTS.filter(s => timeToMinutes(s) <= timeToMinutes("12:00"))
        } else if (availability === "afternoon") {
          allowedSlots = TIME_SLOTS.filter(s => timeToMinutes(s) >= timeToMinutes("12:30"))
        }

        if (date === todayStr) {
          allowedSlots = allowedSlots.filter(s => timeToMinutes(s) >= currentMinutes)
        }

        const key = `${surveyor.full_name}_${date}`
        const dayApts = (aptsByKey[key] || []).sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))

        const availableSlots = allowedSlots.filter(s => isSlotAvailable(s, dayApts))

        if (availableSlots.length === 0) continue

        const firstSlotAfter = getFirstSlotAfterAppointments(dayApts)

        const lastApt = dayApts[dayApts.length - 1]
        let originAddress = surveyor.home_postcode
        if (lastApt?.lead_id && leadAddresses[lastApt.lead_id]) {
          originAddress = leadAddresses[lastApt.lead_id]
        }

        for (let i = 0; i < availableSlots.length; i++) {
          const slot = availableSlots[i]
          const isAfterLastApt = !firstSlotAfter || timeToMinutes(slot) >= timeToMinutes(firstSlotAfter)

          if (dayApts.length > 0 && isAfterLastApt && i < 4) {
            const driveMinutes = await getDriveTime(originAddress, newPropertyAddress)
            const slotData = {
              surveyor: surveyor.full_name,
              date,
              time: slot,
              drive_minutes: driveMinutes,
              origin_address: originAddress,
              is_recommended: driveMinutes !== null && driveMinutes <= 30,
            }
            if (driveMinutes !== null && driveMinutes <= 30) {
              recommendations.push(slotData)
            } else {
              allSlots.push(slotData)
            }
          } else if (dayApts.length === 0 && i < 2) {
            const driveMinutes = await getDriveTime(surveyor.home_postcode, newPropertyAddress)
            const slotData = {
              surveyor: surveyor.full_name,
              date,
              time: slot,
              drive_minutes: driveMinutes,
              origin_address: surveyor.home_postcode,
              is_recommended: driveMinutes !== null && driveMinutes <= 30,
            }
            if (driveMinutes !== null && driveMinutes <= 30) {
              recommendations.push(slotData)
            } else {
              allSlots.push(slotData)
            }
          } else {
            allSlots.push({
              surveyor: surveyor.full_name,
              date,
              time: slot,
              drive_minutes: null,
              origin_address: originAddress,
              is_recommended: false,
            })
          }
        }
      }
    }

    recommendations.sort((a: any, b: any) => a.drive_minutes - b.drive_minutes)

    return new Response(
      JSON.stringify({
        recommendations,
        all_slots: allSlots.slice(0, 100),
        new_property: newPropertyAddress
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err: any) {
    console.log("Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})