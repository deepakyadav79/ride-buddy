import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Calendar, Clock, Car, User, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";

declare global {
  interface Window {
    google: any;
  }
}

interface RideResult {
  id: string;
  start_location: string;
  destination: string;
  ride_date: string;
  ride_time: string;
  available_seats: number;
  price_per_seat: number;
  vehicle_type: string;
  status: string;
  driver_name?: string;
}

export default function SearchRides() {
  const { user } = useAuth();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [results, setResults] = useState<RideResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);

  const handleSearch = async () => {
    setSearching(true);
    try {
      let query = supabase
        .from("rides")
        .select("*")
        .eq("status", "upcoming")
        .gt("available_seats", 0);

      if (pickup) query = query.ilike("start_location", `%${pickup}%`);
      if (destination) query = query.ilike("destination", `%${destination}%`);
      if (date) query = query.eq("ride_date", date);
      if (vehicleType) query = query.ilike("vehicle_type", `%${vehicleType}%`);

      const { data, error } = await query.order("ride_date", { ascending: true });
      if (error) throw error;

      // Fetch driver names
      const driverIds = [...new Set((data || []).map((r: any) => r.driver_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", driverIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      setResults(
        (data || []).map((r: any) => ({
          ...r,
          driver_name: profileMap.get(r.driver_id) || "Unknown Driver",
        }))
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleBook = async (ride: RideResult) => {
    if (!user) {
      toast.error("Please login to book a ride");
      return;
    }

    if (!ride.id || isNaN(ride.price_per_seat)) {
      toast.error("Invalid ride data");
      return;
    }

    setBooking(ride.id);
    try {
      console.log("Attempting to book ride:", {
        ride_id: ride.id,
        passenger_id: user.id,
        seats_booked: 1,
        total_price: ride.price_per_seat,
      });

      const { data, error } = await supabase.from("ride_requests").insert({
        ride_id: ride.id,
        passenger_id: user.id,
        seats_booked: 1,
        total_price: ride.price_per_seat,
        pickup_location: `PENDING:${pickup || ride.start_location}`,
        status: "pending",
      }).select();

      if (error) {
        console.error("Supabase Error booking ride:", error);
        throw error;
      }

      toast.success("Ride requested! Waiting for driver approval.");
      handleSearch(); // refresh
    } catch (err: any) {
      console.error("Critical error in handleBook:", err);
      toast.error(err.message || "An unexpected error occurred during booking.");
    } finally {
      setBooking(null);
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="mb-8 font-display text-3xl font-bold">
          Find a <span className="text-primary">Ride</span>
        </h1>

        {/* Search form */}
        <Card className="mb-8 shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-5">
              <div className="relative rounded-2xl border border-input/40 bg-card p-5 shadow-sm">
                {/* Visual connector between dots */}
                <div className="absolute left-[1.95rem] top-[3.5rem] bottom-[3.5rem] w-0.5 bg-muted-foreground/20"></div>

                <div className="relative z-50 mb-5 flex items-start gap-4">
                  <div className="mt-3 flex h-4 w-4 items-center justify-center rounded-full border-[4px] border-primary/20 bg-primary ring-2 ring-background"></div>
                  <div className="flex-1 space-y-1.5 border-b border-border/50 pb-4">
                    <Label className="text-sm font-semibold text-muted-foreground">Pickup Location</Label>
                    <LocationAutocomplete
                      value={pickup}
                      onChange={setPickup}
                      placeholder="Enter pickup location"
                      className="bg-transparent border-none shadow-none px-0 text-lg font-medium focus-visible:ring-0 md:text-lg h-auto py-0 placeholder:font-normal placeholder:text-muted-foreground/60 w-full"
                    />
                  </div>
                </div>

                <div className="relative z-40 flex items-start gap-4">
                  <div className="mt-3 flex h-4 w-4 items-center justify-center rounded-none border-[4px] border-destructive/20 bg-destructive ring-2 ring-background hover:rounded-sm transition-all"></div>
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-sm font-semibold text-muted-foreground">Destination Location</Label>
                    <LocationAutocomplete
                      value={destination}
                      onChange={setDestination}
                      placeholder="Where to?"
                      className="bg-transparent border-none shadow-none px-0 text-lg font-medium focus-visible:ring-0 md:text-lg h-auto py-0 placeholder:font-normal placeholder:text-muted-foreground/60 w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced search details */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-muted-foreground"><Calendar className="h-4 w-4" /> Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-muted-foreground"><Car className="h-4 w-4" /> Vehicle Type</Label>
                  <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="Any type" className="h-12 rounded-xl" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSearch} className="w-full gradient-hero text-primary-foreground border-0 gap-2 h-12 rounded-xl shadow-md hover:shadow-lg transition-all text-base" disabled={searching}>
                    <Search className="h-5 w-5" />
                    {searching ? "Searching..." : "Find Rides"}
                  </Button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{results.length} ride(s) found</p>
            {results.map((ride, i) => (
              <Card key={ride.id} className="shadow-card transition-all hover:shadow-elevated animate-fade-in" style={{ animationDelay: `${0.05 * i}s` }}>
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-hero">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span className="font-medium">{ride.driver_name}</span>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{ride.vehicle_type}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{ride.start_location}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-destructive" />{ride.destination}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{ride.ride_date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{ride.ride_time}</span>
                      <span>{ride.available_seats} seat(s) left</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-0.5 text-2xl font-bold text-primary font-display">
                        <IndianRupee className="h-5 w-5" />{ride.price_per_seat}
                      </div>
                      <span className="text-xs text-muted-foreground">per seat</span>
                    </div>
                    <Button
                      onClick={() => handleBook(ride)}
                      disabled={booking === ride.id}
                      className="gradient-hero text-primary-foreground border-0"
                    >
                      {booking === ride.id ? "Booking..." : "Book Now"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground">
            <Search className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p className="text-lg">Search for available rides above</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
