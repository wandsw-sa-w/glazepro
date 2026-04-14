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
const MORNING_SLOTS   = TIME_SLOTS.filter(s => s <= "12:00")
const AFTERNOON_SLOTS = TIME_SLOTS.filter(s => s >= "12:30")

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

    // Get all survey appointments in range
    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, assigned_to, date, start_time, end_time, lead_id")
      .gte("date", date_range_start)
      .lte("date", date_range_end)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })

    // Get lead addresses for appointments
    const leadIds = [...new Set((appointments || []).map(a => a.lead_id).filter(Boolean))]
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

    // Get surveyors with home postcodes
    const { data: surveyors } = await supabase
      .from("users")
      .select("id, full_name, home_postcode")
      .eq("is_surveyor", true)
      .not("home_postcode", "is", null)

    // Fetch availability rules for all surveyors
    const surveyorIds = (surveyors || []).map(s => s.id)
    const { data: availabilityRules } = surveyorIds.length > 0
      ? await supabase
          .from("surveyor_availability")
          .select("user_id, day_of_week, availability")
          .in("user_id", surveyorIds)
      : { data: [] }

    // Build lookup: availMap[user_id][day_of_week] = 'full'|'morning'|'afternoon'|'unavailable'
    const availMap: Record<string, Record<number, string>> = {}
    for (const rule of availabilityRules || []) {
      if (!availMap[rule.user_id]) availMap[rule.user_id] = {}
      availMap[rule.user_id][rule.day_of_week] = rule.availability
    }

    // Group appointments by surveyor+date
    const aptsByKey: Record<string, any[]> = {}
    for (const apt of appointments || []) {
      const key = `${apt.assigned_to}_${apt.date}`
      if (!aptsByKey[key]) aptsByKey[key] = []
      aptsByKey[key].push(apt)
    }

    // Generate dates
    const dates: string[] = []
    const start = new Date(date_range_start)
    const end = new Date(date_range_end)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day !== 0) { // exclude Sundays
        dates.push(d.toISOString().split("T")[0])
      }
    }

    const recommendations: any[] = []
    const allSlots: any[] = []

    // Only calculate drive times for days that already have appointments
    // For days without appointments, just list slots without drive time
    for (const surveyor of surveyors || []) {
      for (const date of dates) {
        // Check availability rule for this surveyor on this day of week (0=Sun, 1=Mon … 6=Sat)
        const dayOfWeek = new Date(date + "T12:00:00Z").getUTCDay()
        const rule = availMap[surveyor.id]?.[dayOfWeek] ?? "full"

        if (rule === "unavailable") continue

        const daySlots = rule === "morning"
          ? MORNING_SLOTS
          : rule === "afternoon"
            ? AFTERNOON_SLOTS
            : TIME_SLOTS

        const key = `${surveyor.full_name}_${date}`
        const dayApts = (aptsByKey[key] || []).sort((a, b) => a.start_time.localeCompare(b.start_time))
        const takenSlots = new Set(dayApts.map(a => a.start_time))

        const availableSlots = daySlots.filter(s => !takenSlots.has(s))

        if (dayApts.length > 0) {
          // This day has appointments — calculate drive times for nearby slots only
          // Find the last appointment of the day
          const lastApt = dayApts[dayApts.length - 1]
          const lastAptAddress = lastApt.lead_id ? leadAddresses[lastApt.lead_id] : null
          const originAddress = lastAptAddress || surveyor.home_postcode

          // Only calculate for slots after the last appointment
          const slotsAfterLast = availableSlots.filter(s => s > lastApt.end_time || s > lastApt.start_time)

          for (const slot of slotsAfterLast.slice(0, 5)) {
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
              allSlots.push({ ...slotData, drive_minutes: driveMinutes })
            }
          }

          // Add remaining slots without drive time calculation
          const remainingSlots = availableSlots.filter(s => !slotsAfterLast.slice(0, 5).includes(s))
          for (const slot of remainingSlots) {
            allSlots.push({
              surveyor: surveyor.full_name,
              date,
              time: slot,
              drive_minutes: null,
              origin_address: null,
              is_recommended: false,
            })
          }
        } else {
          // No appointments this day — list all slots from home
          // Only calculate drive time from home for first 3 slots to save API calls
          for (let i = 0; i < availableSlots.length; i++) {
            const slot = availableSlots[i]
            if (i < 3) {
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
                origin_address: surveyor.home_postcode,
                is_recommended: false,
              })
            }
          }
        }
      }
    }

    recommendations.sort((a, b) => a.drive_minutes - b.drive_minutes)

    return new Response(
      JSON.stringify({
        recommendations,
        all_slots: allSlots.slice(0, 100),
        new_property: newPropertyAddress
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.log("Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})