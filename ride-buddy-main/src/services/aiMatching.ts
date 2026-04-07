import { supabase } from "@/integrations/supabase/client";

export interface Ride {
  id: string;
  driver_id: string;
  driver_name?: string;
  start_location: string;
  destination: string;
  ride_date: string;
  ride_time: string;
  available_seats: number;
  price_per_seat: number;
  vehicle_type: string;
  status: string;
}

export interface Hop {
  ride: Ride;
  wait_time?: string;
}

export interface MultiHopRoute {
  hops: Hop[];
  total_price: number;
  total_travel_time?: string;
  total_distance_km?: number;
  safety_score: number;
  ai_recommendation: string;
}

const OPENROUTER_API_KEY = "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";

// Define safe transfer hubs (Real mobility projects use these)
const SAFE_HUBS = [
  "Ameerpet Metro Station",
  "Hitech City Metro Station",
  "Madhapur Metro Station",
  "Gachibowli DLF",
  "Kukatpally Housing Board",
  "Forum Mall",
  "IKEA Hitech City",
  "Secunderabad Station",
  "Begumpet Metro"
];

const checkSafetyScore = (hub: string): number => {
  const isSafeHub = SAFE_HUBS.some(h => hub.toLowerCase().includes(h.toLowerCase()));
  return isSafeHub ? 98 : 82; // Higher score for established hubs
};

export const findMultiHopRides = async (
  pickup: string,
  destination: string,
  date: string
): Promise<MultiHopRoute[]> => {
  try {
    // 1. Fetch all upcoming rides for the given date
    const { data: allRides, error } = await supabase
      .from("rides")
      .select("*")
      .eq("status", "upcoming")
      .eq("ride_date", date)
      .gt("available_seats", 0);

    if (error) throw error;
    if (!allRides || allRides.length === 0) return [];

    // Fetch driver names for all rides
    const driverIds = [...new Set(allRides.map((r) => r.driver_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", driverIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
    
    const ridesWithDrivers: Ride[] = allRides.map(r => ({
      ...r,
      driver_name: profileMap.get(r.driver_id) || "Driver"
    }));

    // 2. Simple BFS/Graph search to find potential paths (max 3 hops)
    const routes: MultiHopRoute[] = [];

    // Check for direct rides first (already handled by SearchRides, but good to have here)
    const directRides = ridesWithDrivers.filter(
      r => r.start_location.toLowerCase().includes(pickup.toLowerCase()) && 
           r.destination.toLowerCase().includes(destination.toLowerCase())
    );

    // Find 2-hop paths: Pickup -> Hub -> Destination
    for (const ride1 of ridesWithDrivers) {
      if (ride1.start_location.toLowerCase().includes(pickup.toLowerCase())) {
        const hub = ride1.destination;
        for (const ride2 of ridesWithDrivers) {
          if (ride2.id === ride1.id) continue;
          
          if (ride2.start_location.toLowerCase().includes(hub.toLowerCase()) && 
              ride2.destination.toLowerCase().includes(destination.toLowerCase())) {
            
            // Check timing (Ride 2 must be after Ride 1)
            // Note: In real app, we'd compare time strings or date objects
            if (ride2.ride_time > ride1.ride_time) {
              const safety = checkSafetyScore(hub);
              routes.push({
                hops: [{ ride: ride1 }, { ride: ride2 }],
                total_price: Number(ride1.price_per_seat) + Number(ride2.price_per_seat),
                safety_score: safety,
                ai_recommendation: ""
              });
            }
          }
        }
      }
    }

    if (routes.length === 0) return [];

    // 3. Use OpenRouter AI to analyze routes and suggest the best one
    // We'll use a better model and more detailed prompt
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo", 
        messages: [
          {
            role: "system",
            content: `You are a Smart Mobility AI Assistant specialized in multi-hop carpooling. 
            Analyze the following routes. 
            Prioritize routes where the transfer hub is one of these: ${SAFE_HUBS.join(", ")}.
            Return the input JSON but with updated safety_score, added ai_recommendation, an estimated 'total_distance_km' (number), and 'total_travel_time' (string, e.g., '1h 20m').
            Ensure the JSON structure exactly follows: { "routes": [...] }`
          },
          {
            role: "user",
            content: `Origin: ${pickup}, Destination: ${destination}, Date: ${date}. 
            Current Candidates: ${JSON.stringify(routes.slice(0, 5))}
            Estimate distance and total travel time based on the route locations and provide a 1-sentence mobility insight in 'ai_recommendation'.`
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const aiData = await response.json();
    console.log("AI Response:", aiData);
    
    // Attempt to extract the refined routes from AI response
    try {
      const content = aiData.choices[0].message.content;
      const parsed = JSON.parse(content);
      return parsed.routes || routes;
    } catch (e) {
      return routes;
    }

  } catch (error) {
    console.error("Multi-Hop Search Error:", error);
    return [];
  }
};
