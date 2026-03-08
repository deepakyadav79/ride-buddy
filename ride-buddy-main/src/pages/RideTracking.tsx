import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendSOSAlert } from "@/services/safetyService";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issues in React Vite builds
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const MapComponent = ({ start, destination }: { start: string, destination: string }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    const loadPoints = async () => {
      try {
        // Geocode both addresses via Nominatim API gracefully
        const startRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(start)}&limit=1`);
        const destRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=1`);

        const startData = await startRes.json();
        const destData = await destRes.json();

        if (startData.length > 0 && destData.length > 0) {
          const startLon = parseFloat(startData[0].lon);
          const startLat = parseFloat(startData[0].lat);
          const destLon = parseFloat(destData[0].lon);
          const destLat = parseFloat(destData[0].lat);

          const p1: [number, number] = [startLat, startLon];
          const p2: [number, number] = [destLat, destLon];

          const marker1 = L.marker(p1).addTo(map).bindPopup(`<b>Pickup:</b> ${start}`).openPopup();
          const marker2 = L.marker(p2).addTo(map).bindPopup(`<b>Destination:</b> ${destination}`);

          // Fetch route from free OSRM API
          const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson`);
          const routeData = await routeRes.json();

          if (routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0) {
            const coordinates = routeData.routes[0].geometry.coordinates; // array of [lon, lat]
            const latlngs = coordinates.map((c: any) => [c[1], c[0]] as [number, number]);

            // Draw polyline
            const routeLine = L.polyline(latlngs, { color: '#3b82f6', weight: 5 }).addTo(map);

            const group = L.featureGroup([marker1, marker2, routeLine]);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });

            // Simulate live tracking with a moving car marker
            const carIcon = L.divIcon({
              className: 'custom-car-icon',
              html: `<div style="background-color: white; border-radius: 50%; padding: 6px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 2px solid #3b82f6; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });
            const trackingMarker = L.marker(latlngs[0], { icon: carIcon, zIndexOffset: 1000 }).addTo(map).bindPopup("Driver");

            // Move the car marker along the coordinates to simulate tracking
            let currentIndex = 0;
            const animateCar = () => {
              if (currentIndex < latlngs.length - 1) {
                currentIndex++;
                trackingMarker.setLatLng(latlngs[currentIndex]);
                (map as any)._trackingTimeout = setTimeout(animateCar, 500); // Update every 500ms
              }
            };

            // Start the animation slightly after loading
            (map as any)._trackingTimeout = setTimeout(animateCar, 2000);
          } else {
            // Fallback if no route found but we have coords
            const group = L.featureGroup([marker1, marker2]);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
            L.polyline([p1, p2], { color: '#3b82f6', weight: 4, dashArray: '10, 10' }).addTo(map);
          }
        } else {
          setMapError("Could not perfectly geocode these locations.");
        }
      } catch (e) {
        console.error("Geocoding map error:", e);
        setMapError("Failed to fetch map route data.");
      }
    };

    if (start && destination) {
      loadPoints();
    }

    // Cleanup on unmount to prevent rendering issues with Leaflet instances
    return () => {
      if ((map as any)._trackingTimeout) {
        clearTimeout((map as any)._trackingTimeout);
      }
      map.remove();
    };
  }, [start, destination]);

  return (
    <div className="w-full h-full relative" style={{ minHeight: "500px" }}>
      {mapError && (
        <div className="absolute inset-0 z-[10] flex items-center justify-center bg-background/80 font-semibold text-destructive backdrop-blur-sm">
          {mapError}
        </div>
      )}
      {/* Set z-index 0 to not overlap navbar dropdowns and positioning absolute */}
      <div ref={mapRef} className="w-full h-full absolute inset-0 z-0"></div>
    </div>
  );
};

export default function RideTracking() {
  const { rideId } = useParams();
  const { user } = useAuth();

  const [booking, setBooking] = useState<any>(null);
  const [ride, setRide] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [passenger, setPassenger] = useState<any>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<any[]>([]);
  const [sosLoading, setSosLoading] = useState(false);

  useEffect(() => {
    async function fetchDetails() {
      if (!rideId || !user) return;

      const { data: bData } = await supabase.from('ride_requests').select('*').eq('id', rideId).single();
      if (bData) {
        setBooking(bData);

        // Fetch passenger profile
        const { data: pData } = await supabase.from('profiles').select('*').eq('user_id', bData.passenger_id).single();
        if (pData) setPassenger(pData);

        // fetch the ride assigned to that booking
        const { data: rData } = await supabase.from('rides').select('*').eq('id', bData.ride_id).single();
        if (rData) {
          setRide(rData);
          // fetch driver profile info
          const { data: dData } = await supabase.from('profiles').select('*').eq('user_id', rData.driver_id).single();
          if (dData) setDriver(dData);
        }

        // Fetch user's emergency contacts
        const { data: eData } = await supabase.from('emergency_contacts').select('*').eq('user_id', user.id);
        if (eData) setEmergencyContacts(eData);
      }
    }
    fetchDetails();
  }, [rideId, user]);

  const handleSOS = () => {
    setSosLoading(true);
    if (!navigator.geolocation) {
      triggerAlert(null, null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        triggerAlert(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        triggerAlert(null, null);
      }
    );
  };

  const triggerAlert = async (lat: number | null, lng: number | null) => {
    const isPassenger = user?.id === booking?.passenger_id;
    const otherParty = isPassenger ? driver : passenger;
    const myDetails = isPassenger ? passenger : driver;

    // Send real SOS via safetyService
    const sosData = {
      latitude: lat,
      longitude: lng,
      passengerName: passenger?.full_name || "Unknown",
      passengerPhone: passenger?.phone || "",
      driverName: driver?.full_name || "Unknown",
      driverPhone: driver?.phone || "",
      vehicleNumber: driver?.vehicle_number || "Unknown",
      vehicleType: driver?.vehicle_type || "Unknown",
      emergencyContacts: emergencyContacts.map(c => ({ name: c.name, phone: c.phone })),
    };

    try {
      await sendSOSAlert(sosData);
      setSosLoading(false);

      const locText = lat && lng ? `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}` : "Route Trace Active";

      // 1. Police Alert Toast
      toast.error("🚨 EMERGENCY ALERT ACTIVATED!", {
        description: `DETAILS SENT TO POLICE AND EMERGENCY SYSTEM:\n- Passenger: ${passenger?.full_name}\n- Driver: ${driver?.full_name}\n- Location: ${locText}`,
        duration: 10000,
      });

      // 2. Emergency Contact Toast
      if (emergencyContacts.length > 0) {
        const contactNames = emergencyContacts.map(c => c.name).join(", ");
        toast.info("📱 Emergency Contacts Notified", {
          description: `An alert has been sent to your contacts: ${contactNames}.`,
          duration: 10000,
        });
      }
    } catch (error) {
      console.error("SOS Alert Failed:", error);
      setSosLoading(false);
      toast.error("Failed to transmit SOS alert. Please call 112 directly.");
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <h1 className="mb-8 font-display text-3xl font-bold">
          Live <span className="text-primary">Tracking</span>
        </h1>

        <Card className="shadow-elevated overflow-hidden">
          <CardContent className="p-0">
            {/* Map Integration */}
            <div className="relative flex h-[500px] w-full items-center justify-center bg-muted/50 overflow-hidden">
              {ride ? (
                <MapComponent start={ride.start_location || ''} destination={ride.destination || ''} />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground w-full h-full absolute z-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="animate-pulse">Loading Live Map...</span>
                </div>
              )}
            </div>

            {/* Ride info bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t p-4 gap-4 relative z-10 bg-card">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="line-clamp-1 max-w-[200px]">{ride?.start_location || "Pickup"}</span>
                </div>
                <span className="text-muted-foreground hidden sm:block">→</span>
                <div className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-4 w-4 text-destructive shrink-0" />
                  <span className="line-clamp-1 max-w-[200px]">{ride?.destination || "Destination"}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-2 mr-2">
                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse-dot" />
                  <span className="text-sm font-medium text-accent">Live</span>
                </div>
                <Button
                  onClick={handleSOS}
                  disabled={sosLoading}
                  variant="destructive"
                  className="gap-2 font-bold shadow-md hover:shadow-lg transition-all animate-fade-in shrink-0"
                >
                  {sosLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Contacting Police...</>
                  ) : (
                    <><ShieldAlert className="h-4 w-4" /> SOS Emergency</>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
