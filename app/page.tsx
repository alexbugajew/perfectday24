"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Home() {
  const [locations, setLocations] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .limit(5)

      if (error) {
        console.error(error)
      } else {
        setLocations(data || [])
      }
    }

    loadData()
  }, [])

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>PerfectDay24 🚀</h1>
      <p>Erste Verbindung zu Supabase läuft...</p>

      <h2>Locations Test:</h2>
      {locations.length === 0 && <p>Keine Daten gefunden.</p>}

      {locations.map((loc) => (
        <div key={loc.id} style={{ marginBottom: "10px" }}>
          <strong>{loc.name}</strong>
        </div>
      ))}
    </main>
  )
}