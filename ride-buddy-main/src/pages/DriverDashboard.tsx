import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Calendar, Clock, Users, IndianRupee, Play, Square, Car, Bell, User, Check, X, History } from "lucide-react";
import { toast } from "sonner";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";

interface Ride {
  id: string;
  start_location: string;
  destination: string;
  ride_date: string;
  ride_time: string;
  available_seats: number;
  price_per_seat: number;
  vehicle_type: string;
  status: string;
}

export default function DriverDashboard() {
  const { user, profile } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [startLocation, setStartLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");
  const [seats, setSeats] = useState("4");
  const [price, setPrice] = useState("");

  const fetchRides = async () => {
    if (!user) return;
    const { data: ridesData } = await supabase
      .from("rides")
      .select("*")
      .eq("driver_id", user.id)
      .order("ride_date", { ascending: false });

    const fetchedRides = (ridesData || []) as Ride[];

    // Auto-heal negative seats if any (prevents "Available: -1" errors)
    for (const r of fetchedRides) {
      if (r.available_seats < 0) {
        await supabase.from("rides").update({ available_seats: 0 }).eq("id", r.id);
        r.available_seats = 0;
      }
    }

    setRides(fetchedRides);

    if (fetchedRides.length > 0) {
      const rideIds = fetchedRides.map((r) => r.id);
      const validRideIds = rideIds.filter(id => !!id && typeof id === 'string');

      const { data: reqData, error: reqError } = await supabase
        .from("ride_requests")
        .select(`
          *,
          ride:rides (
            start_location,
            destination,
            ride_date,
            ride_time,
            available_seats
          )
        `)
        .in("ride_id", validRideIds)
        .eq("status", "pending");

      if (reqError) {
        console.error("Error fetching bookings:", reqError);
        toast.error("Failed to load requests: " + reqError.message);
      } else {
        console.log(`Fetched ${reqData?.length || 0} pending requests for ${validRideIds.length} rides`);
      }

      if (reqData && reqData.length > 0) {
        const passengerIds = reqData.map((r: any) => r.passenger_id);
        const { data: profData } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", passengerIds);

        const profMap = new Map((profData || []).map((p: any) => [p.user_id, p]));

        const mappedReqs = reqData.map((r: any) => {
          const p = profMap.get(r.passenger_id);
          return {
            ...r,
            passenger_name: p?.full_name || "Unknown",
            passenger_phone: p?.phone || "No phone provided",
          };
        });
        setRequests(mappedReqs);
      } else {
        setRequests([]);
      }
    }
  };

  useEffect(() => {
    fetchRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const seatsNum = parseInt(seats);
    const priceNum = parseFloat(price);

    if (!startLocation || !destination || !rideDate || !rideTime || isNaN(seatsNum) || isNaN(priceNum)) {
      toast.error("Please fill in all required fields with valid values");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from("rides").insert({
        driver_id: user.id,
        start_location: startLocation,
        destination,
        ride_date: rideDate,
        ride_time: rideTime,
        available_seats: seatsNum,
        price_per_seat: priceNum,
        vehicle_type: profile?.vehicle_type || "Sedan",
      }).select();

      if (error) {
        console.error("Supabase error posting ride:", error);
        throw error;
      }

      toast.success("Ride posted!");
      setShowForm(false);
      setStartLocation(""); setDestination(""); setRideDate(""); setRideTime(""); setPrice("");
      fetchRides();
    } catch (err: unknown) {
      console.error("Critical error in handlePost:", err);
      const message = err instanceof Error ? err.message : "Failed to post ride";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("rides").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Ride ${status === "in_progress" ? "started" : status}!`);
      fetchRides();
    }
  };

  const handleRequest = async (bookingId: string, action: "confirmed" | "rejected", rideId: string, seats_booked: number) => {
    try {
      const pReq = requests.find(r => r.id === bookingId);
      const passengerId = pReq?.passenger_id;

      if (action === "confirmed") {
        // 1. Fetch LATEST ride data to prevent race conditions
        const { data: rideData, error: rideFetchError } = await supabase
          .from("rides")
          .select("available_seats, start_location, destination")
          .eq("id", rideId)
          .single();

        if (rideFetchError) throw new Error("Could not verify ride capacity: " + rideFetchError.message);

        const currentAvailable = rideData.available_seats || 0;

        // 2. Strict seat validation
        if (currentAvailable < seats_booked) {
          throw new Error(`Not enough seats! Required: ${seats_booked}, Available: ${currentAvailable}`);
        }

        // 3. Update the ride_request (Confirm)
        const cleanLoc = (pReq?.pickup_location || "").replace("PENDING:", "");
        const { error: bookingUpdateError } = await supabase
          .from("ride_requests")
          .update({ pickup_location: cleanLoc, status: "accepted" })
          .eq("id", bookingId);

        if (bookingUpdateError) throw new Error("Failed to confirm request: " + bookingUpdateError.message);

        // 4. Update the ride's remaining seats
        const newAvailableCount = currentAvailable - seats_booked;
        const { error: rideUpdateError } = await supabase
          .from("rides")
          .update({ available_seats: Math.max(0, newAvailableCount) })
          .eq("id", rideId);

        if (rideUpdateError) throw new Error("Failed to update ride seats: " + rideUpdateError.message);

        // 5. AUTO-REJECT other pending requests if no seats left
        if (newAvailableCount <= 0) {
          // Identify other pending ride_requests for this ride
          const { data: otherBookings } = await supabase
            .from("ride_requests")
            .select("id")
            .eq("ride_id", rideId)
            .eq("status", "pending")
            .neq("id", bookingId);

          if (otherBookings && otherBookings.length > 0) {
            await supabase
              .from("ride_requests")
              .update({ status: "rejected" })
              .in("id", otherBookings.map(b => b.id));

            console.log(`Auto-rejected ${otherBookings.length} pending requests as ride is now full.`);
          }
        }

        // 6. Send notification (Safe failure if table missing)
        if (passengerId) {
          try {
            const { error: notifError } = await (supabase.from("notifications") as any).insert({
              user_id: passengerId,
              title: "Ride Request Accepted! ✅",
              message: `Your ride from ${rideData.start_location} to ${rideData.destination} has been accepted.`,
              type: "success"
            });
            const isMissing = notifError && (notifError.code === "42P01" || notifError.code === "PGRST205" || notifError.message?.includes("notifications"));
            if (notifError && !isMissing) console.error("Notification Error:", notifError);
          } catch (e) { console.warn("Notifications unavailable"); }
        }

      } else { // Handle REJECTION
        const { error: bookingUpdateError } = await supabase
          .from("ride_requests")
          .update({ status: "rejected" })
          .eq("id", bookingId);

        if (bookingUpdateError) throw bookingUpdateError;

        if (passengerId) {
          try {
            const ride = rides.find(r => r.id === rideId);
            const { error: notifError } = await (supabase.from("notifications") as any).insert({
              user_id: passengerId,
              title: "Ride Request Rejected ❌",
              message: `Your ride request from ${ride?.start_location} to ${ride?.destination} was rejected.`,
              type: "error"
            });
            const isMissing = notifError && (notifError.code === "42P01" || notifError.code === "PGRST205" || notifError.message?.includes("notifications"));
            if (notifError && !isMissing) console.error("Notification Error:", notifError);
          } catch (e) { console.warn("Notifications unavailable"); }
        }
      }

      toast.success(`Request ${action === "confirmed" ? "accepted" : "rejected"}!`);
      await fetchRides();
    } catch (err: unknown) {
      console.error("Critical error in handleRequest:", err);
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred.");
      fetchRides();
    }
  };

  const statusColor: Record<string, string> = {
    upcoming: "bg-secondary/10 text-secondary",
    in_progress: "bg-accent/10 text-accent",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-3xl font-bold">
            Driver <span className="text-primary">Dashboard</span>
          </h1>
          <div className="flex gap-2">
            <Button onClick={fetchRides} variant="outline" className="gap-2">
              <History className="h-4 w-4" /> Refresh
            </Button>
            <Button onClick={() => setShowForm(!showForm)} className="gap-2 gradient-hero text-primary-foreground border-0">
              <Plus className="h-4 w-4" /> Post Ride
            </Button>
          </div>
        </div>

        {/* Post ride form */}
        {showForm && (
          <Card className="mb-8 shadow-elevated animate-fade-in">
            <CardHeader>
              <CardTitle className="font-display">Post a New Ride</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePost} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 z-50">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />Start Location</Label>
                  <LocationAutocomplete value={startLocation} onChange={setStartLocation} placeholder="Pickup point" />
                </div>
                <div className="space-y-2 z-40">
                  <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-destructive" />Destination</Label>
                  <LocationAutocomplete value={destination} onChange={setDestination} placeholder="Drop-off point" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Date</Label>
                  <Input type="date" value={rideDate} onChange={(e) => setRideDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Time</Label>
                  <Input type="time" value={rideTime} onChange={(e) => setRideTime(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Available Seats</Label>
                  <Input type="number" min="1" max="8" value={seats} onChange={(e) => setSeats(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5" />Price per Seat</Label>
                  <Input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₹" required />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="gradient-hero text-primary-foreground border-0" disabled={loading}>
                    {loading ? "Posting..." : "Post Ride"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Pending Requests */}
        {requests.length > 0 && (
          <div className="mb-8 space-y-4">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" /> Pending Requests
            </h2>
            {requests.map((req) => (
              <Card key={req.id} className="shadow-card border-l-4 border-l-primary animate-fade-in">
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 font-medium">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0">
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base">{req.passenger_name}</span>
                        <span className="text-sm font-normal text-muted-foreground">{req.passenger_phone}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{req.pickup_location || req.ride?.start_location}</span>
                      <span>→</span>
                      <span>{req.ride?.destination}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm font-medium">
                      <span className="text-muted-foreground">{req.ride?.ride_date} at {req.ride?.ride_time}</span>
                      <span className="text-primary">{req.seats_booked} seat(s) • ₹{req.total_price}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleRequest(req.id, "confirmed", req.ride_id, req.seats_booked)}
                      disabled={(req.ride?.available_seats || 0) < req.seats_booked}
                      className={`gap-1 ${((req.ride?.available_seats || 0) < req.seats_booked) ? 'bg-muted text-muted-foreground grayscale cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'} border-0`}
                    >
                      <Check className="h-4 w-4" /> {(req.ride?.available_seats || 0) < req.seats_booked ? "Full" : "Accept"}
                    </Button>
                    <Button onClick={() => handleRequest(req.id, "rejected", req.ride_id, req.seats_booked)} variant="outline" className="gap-1 text-destructive hover:bg-destructive/10 border-destructive/20">
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Rides list */}
        <div className="space-y-4">
          {rides.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Car className="mx-auto mb-4 h-12 w-12 opacity-30" />
              <p>No rides posted yet. Click "Post Ride" to get started!</p>
            </div>
          ) : (
            rides.map((ride, i) => (
              <Card key={ride.id} className="shadow-card animate-fade-in" style={{ animationDelay: `${0.05 * i}s` }}>
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[ride.status || "upcoming"]}`}>
                        {(ride.status || "upcoming").replace("_", " ")}
                      </span>
                      <span className="text-sm text-muted-foreground">{ride.vehicle_type}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{ride.start_location}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-destructive" />{ride.destination}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>{ride.ride_date}</span>
                      <span>{ride.ride_time}</span>
                      <span>{ride.available_seats} seats</span>
                      <span className="font-semibold text-primary">₹{ride.price_per_seat}/seat</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ride.status === "upcoming" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "in_progress")} className="gap-1 gradient-success text-accent-foreground border-0">
                        <Play className="h-3.5 w-3.5" /> Start
                      </Button>
                    )}
                    {ride.status === "in_progress" && (
                      <Button size="sm" onClick={() => updateStatus(ride.id, "completed")} variant="outline" className="gap-1">
                        <Square className="h-3.5 w-3.5" /> End
                      </Button>
                    )}
                    {ride.status === "upcoming" && (
                      <Button size="sm" variant="outline" onClick={() => updateStatus(ride.id, "cancelled")} className="text-destructive">
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
