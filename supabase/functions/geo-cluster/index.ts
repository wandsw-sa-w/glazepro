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
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${GOOGLE_MAPS_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  const element = data.rows?.[0]?.elements?.[0]
  if (element?.status === "OK") {
    return Math.round(element.duration.value / 60)
  }
  return null
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

    // Get all survey appointments in the date range
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*, leads(property_road, property_town, property_postcode)")
      .eq("type", "Survey")
      .gte("date", date_range_start)
      .lte("date", date_range_end)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })

    if (error) throw error

    // Get all surveyors with their home postcodes
    const { data: surveyors } = await supabase
      .from("users")
      .select("full_name, email, home_postcode")
      .eq("active", true)

    // Group appointments by surveyor and date
    const appointmentsByKey: Record<string, any[]> = {}
    for (const apt of appointments || []) {
      const key = `${apt.assigned_to}_${apt.date}`
      if (!appointmentsByKey[key]) appointmentsByKey[key] = []
      appointmentsByKey[key].push(apt)
    }

    // For each surveyor, find available slots and calculate drive times
    const recommendations: any[] = []
    const allSlots: any[] = []

    const timeSlots = []
    for (let h = 7; h <= 17; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 7 && m < 30) continue
        if (h === 17 && m > 30) continue
        timeSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
      }
    }

    // Generate dates in range
    const dates: string[] = []
    const start = new Date(date_range_start)
    const end = new Date(date_range_end)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0])
    }

    for (const surveyor of surveyors || []) {
      for (const date of dates) {
        const key = `${surveyor.full_name}_${date}`
        const dayAppointments = appointmentsByKey[key] || []

        // Sort by time
        dayAppointments.sort((a, b) => a.start_time.localeCompare(b.start_time))

        // Find the appointment just before each available slot
        for (const slot of timeSlots) {
          // Check if slot is already taken
          const slotTaken = dayAppointments.some(apt => apt.start_time === slot)
          if (slotTaken) continue

          // Find previous appointment
          const prevApt = dayAppointments
            .filter(apt => apt.start_time < slot)
            .pop()

          let originAddress: string
          if (prevApt && prevApt.leads) {
            const l = prevApt.leads
            originAddress = [l.property_road, l.property_town, l.property_postcode].filter(Boolean).join(", ")
          } else {
            originAddress = surveyor.home_postcode || ""
          }

          if (!originAddress) continue

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
        }
      }
    }

    // Sort recommendations by drive time
    recommendations.sort((a, b) => a.drive_minutes - b.drive_minutes)

    return new Response(
      JSON.stringify({ recommendations, all_slots: allSlots.slice(0, 50) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.log("Error:", err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})