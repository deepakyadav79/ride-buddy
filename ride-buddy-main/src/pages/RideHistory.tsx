import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Clock, IndianRupee, History } from "lucide-react";
import { toast } from "sonner";

interface Booking {
  id: string;
  seats_booked: number;
  total_price: number;
  status: string;
  pickup_location: string | null;
  created_at: string;
  ride: {
    start_location: string;
    destination: string;
    ride_date: string;
    ride_time: string;
    vehicle_type: string;
    status: string;
  };
}

export default function RideHistory() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("ride_requests")
        .select("*, ride:rides(start_location, destination, ride_date, ride_time, vehicle_type, status)")
        .eq("passenger_id", user.id)
        .order("created_at", { ascending: false });
      const mappedData = (data || []).map((b: any) => {
        const isPending = b.pickup_location?.startsWith("PENDING:");
        return {
          ...b,
          status: isPending ? "pending" : b.status,
          pickup_location: isPending ? b.pickup_location.replace("PENDING:", "") : b.pickup_location,
        };
      });
      setBookings(mappedData as unknown as Booking[]);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const cancelBooking = async (id: string) => {
    const { error } = await supabase.from("ride_requests").update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Request cancelled");
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
    }
  };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    accepted: "bg-accent/10 text-accent",
    confirmed: "bg-accent/10 text-accent",
    rejected: "bg-destructive/10 text-destructive",
    cancelled: "bg-destructive/10 text-destructive",
    completed: "bg-muted text-muted-foreground",
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="mb-8 font-display text-3xl font-bold">
          Ride <span className="text-primary">History</span>
        </h1>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <History className="mx-auto mb-4 h-12 w-12 opacity-30" />
            <p>No ride history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b, i) => (
              <Card key={b.id} className="shadow-card animate-fade-in" style={{ animationDelay: `${0.05 * i}s` }}>
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 space-y-2">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />{b.pickup_location || b.ride.start_location}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-destructive" />{b.ride.destination}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{b.ride.ride_date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{b.ride.ride_time}</span>
                      <span>{b.ride.vehicle_type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-0.5 text-xl font-bold text-primary font-display">
                        <IndianRupee className="h-4 w-4" />{b.total_price}
                      </div>
                      <span className="text-xs text-muted-foreground">{b.seats_booked} seat(s)</span>
                    </div>
                    {(b.status === "confirmed" || b.status === "accepted" || b.status === "pending") && (
                      <div className="flex gap-2">
                        {(b.status === "confirmed" || b.status === "accepted") && (
                          <Link to={`/tracking/${b.id}`}>
                            <Button size="sm" className="gradient-hero text-primary-foreground border-0">
                              Track Ride
                            </Button>
                          </Link>
                        )}
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => cancelBooking(b.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
